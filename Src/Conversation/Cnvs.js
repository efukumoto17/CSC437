var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');

router.baseURL = '/Cnvs';

router.get('/', function(req, res) {
   var prsId = parseInt(req.query.owner);
   var cnn = req.cnn;
   var vld = req.validator;
   if(isNaN(prsId))
      prsId = req.query.owner;

   async.waterfall([
         function(cb){
            var query = 'select * from Conversation'
            if(prsId)
               cnn.chkQry(query + ' where id = ?', prsId, cb);
            else 
               cnn.chkQry(query, null, cb);
         },
         function(cnvs, fields, cb){
            res.json(cnvs);
            cb();
         }
      ],
      function(err){
         cnn.release()
      });

});

router.post('/', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;
   
   body.ownerId = vld.session.prsId;
   // need to check title length
   async.waterfall([
   function(cb) {
      if(vld.check(body.title, Tags.missingField, ["title"], cb) &&
        vld.checkStrings(body, cb)
         .check(typeof body.title === 'string', Tags.badValue, ["title"], cb) &&
        vld.checkFieldLengths(body, cb))
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

router.get('/:cnvId', function(req, res){
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;
   var cnvId = req.params.cnvId;
   
   async.waterfall([
      function(cb){
         cnn.chkQry('select * from Conversation where id = ?', cnvId, cb);
      },
      function(cnv, fields, cb){
         if(vld.check(cnv.length, Tags.notFound, cb)){
            res.json(cnv[0])
         }
         cb()
      }
   ],
   function(err){
      cnn.release();
   })
});

router.put('/:cnvId', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;
   var cnvId = req.params.cnvId;
   async.waterfall([
   function(cb) {
      if(vld.check('title' in body && body.title !== "", Tags.missingField, ['title'], cb) &&
       vld.check(body.title !== "", Tags.badValue, ['title'], cb) &&
       vld.checkFieldLengths(body, cb)
       .chain(typeof body.title === 'string', Tags.badValue, ["title"], cb)
       .check(body.title.length > 0, Tags.badValue, ['title'], cb))
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.checkPrsOK(cnvs[0].ownerId, cb))// result is a bug
       // <> is not equal to bc its ok to rename to the same name
         cnn.chkQry('select * from Conversation where id <> ? && title = ?',
          [cnvId, body.title], cb);
   },
   function(sameTtl, fields, cb) {
      if (vld.check(!sameTtl.length, Tags.dupTitle, null, cb))
         cnn.chkQry("update Conversation set title = ? where id = ?",
          [body.title, cnvId], cb);
   },
   function(insert, fields, cb) {
      res.end();
      cb();
   }],
   function(err) {
      cnn.release();
   });
});

router.delete('/:cnvId', function(req, res) {
   var vld = req.validator;
   var cnvId = req.params.cnvId;
   var cnn = req.cnn;
   var body = req.body;

   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.checkPrsOK(cnvs[0].ownerId, cb))// results[] undef here
         cnn.chkQry('delete from Conversation where id = ?', [cnvId], cb);
   },
   function(deleted, fields, cb) {
      cnn.chkQry('delete from Message where cnvId = ?', [cnvId], cb);
   },
   function(deleted, fields, cb){
      res.end();
      cb();
   }],
   function(err) {
      // res.status(200).end();
      cnn.release();
   });
});

router.get('/:cnvId/Msgs', function(req, res){
   var dateTime = req.query.dateTime;
   var num = parseInt(req.query.num);
   var cnvId = req.params.cnvId;
   var vld = req.validator;
   var cnn = req.cnn;
   var ret = [];
   if(isNaN(num))
      num = req.query.num

   async.waterfall([
      function(cb) {
         cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb)
      },
      function(cnv, fields, cb){
         if(vld.check(cnv.length, Tags.notFound, null, cb)){
            if(num && dateTime)
               cnn.chkQry('select m.id, prsId, numLikes, whenMade, email, content '
               + 'from Conversation c join Message m on cnvId = c.id '
               + 'join Person p on prsId = p.id where c.id = ? '
               +'order by whenMade where whenMade < ?, id limit ?', 
                [cnvId,num], cb)
            else if(num)
               cnn.chkQry('select m.id, prsId, numLikes, whenMade, email, content '
               + 'from Conversation c join Message m on cnvId = c.id '
               + 'join Person p on prsId = p.id where c.id = ? '
               +'order by whenMade, id limit ?', [cnvId,num], cb)
            else if(dateTime)
               cnn.chkQry('select m.id, prsId, numLikes, whenMade, email, content '
               + 'from Conversation c join Message m on cnvId = c.id '
               + 'join Person p on prsId = p.id where c.id = ? '
               +'order by whenMade where whenMade < ?', [cnvId,dateTime], cb)
            else
               cnn.chkQry('select m.id, prsId, numLikes, whenMade, email, content '
               + 'from Conversation c join Message m on cnvId = c.id '
               + 'join Person p on prsId = p.id where c.id = ? '
               +'order by whenMade, id', [cnvId], cb)
         }
      },
      function(msgs, fields, cb) {
         res.json(msgs);
         cb();
      }
   ],
   function(err) {
      cnn.release();
   });

});

router.post('/:cnvId/Msgs', function(req, res){
   var vld = req.validator;
   var cnvId = req.params.cnvId;
   var cnn = req.cnn;
   var body = req.body;
   body.whenMade = new Date();
   body.prsId = vld.session.prsId;
   body.cnvId = cnvId;

   async.waterfall([
      function(cb){
         if(vld.chain(body.content, Tags.missingField, ["content"]) &&
          vld.chain(typeof body.content === 'string', Tags.badValue, ["content"], cb)
          .checkFieldLengths(body, cb).check(true, null, null, cb))
            cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb)
      },
      function(cnv, fields, cb){
         body.numLikes = 0;
         if(vld.check(cnv.length, Tags.notFound, null, cb))
            cnn.chkQry('insert into Message set ?', body, cb); 
      },
      function(pst, fields, cb){
         res.location('/Msgs/' + pst.insertId);
         cnn.chkQry('update Conversation set lastMessage = ? where id = ?', 
          [new Date()/* .getTime() */, cnvId], cb)
      },
      function(updRes, fields, cb){
         res.end();
         cb();
      }
   ],
   function(err){
      cnn.release();
      res.end();
   });
});

module.exports = router;
