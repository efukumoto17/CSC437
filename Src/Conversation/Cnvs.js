var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');

router.baseURL = '/Cnvs';

router.get('/', function(req, res) {
   req.cnn.chkQry('select id, title from Conversation', null,
   function(err, cnvs) {
      if (!err)
         res.json(cnvs);
      req.cnn.release();
   });
});

router.post('/', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;

   // need to check title length
   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Conversation where title = ?', body.title, cb);
   },
   function(existingCnv, fields, cb) {
      if (vld.check(!existingCnv.length, Tags.dupTitle, null, cb))
         cnn.chkQry("insert into Conversation set ?", body, cb);
   },
   function(insRes, fields, cb) {
      res.location(router.baseURL + '/' + insRes.insertId).end();
      cb();// if you call cb(false) we wont call the finally
   }],
   function() {
      cnn.release();
   });
});

router.put('/:cnvId', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;
   var cnvId = req.params.cnvId;

   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.checkPrsOK(result[0].prsId, cb))// result is a bug
       // <> is not equal to bc its ok to rename to the same name
         cnn.chkQry('select * from Conversation where id <> ? && title = ?',
          [cnvId, body.title], cb);
   },
   function(sameTtl, fields, cb) {
      if (vld.check(!sameTtl.length, Tags.dupTitle, cb))
         cnn.chkQry("update Conversation set title = ? where id = ?",
          [body.title, cnvId], cb);// need a res.end();
   }],
   function(err) {
      cnn.release();
   });
});

router.delete('/:cnvId', function(req, res) {
   var vld = req.validator;
   var cnvId = req.params.cnvId;
   var cnn = req.cnn;

   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.checkPrsOK(result[0].prsID, cb))// results[] undef here
         cnn.chkQry('delete from Conversation where id = ?', [cnvId], cb);
   }],
   function(err) {
      if (!err)
         cnn.status(200);// res.status(200).end();
      cnn.release();
   });
});

module.exports = router;
