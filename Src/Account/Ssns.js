var Express = require('express');
var Tags = require('../Validator.js').Tags;
var {Session, router} = require('../Session.js');
var router = Express.Router({caseSensitive: true});

router.baseURL = '/Ssns';

router.get('/', function(req, res) {
   var body = [], ssn;
   var cb = function(){
      res.end();
   }

   if (req.validator.checkAdmin(cb)) {
      Session.getAllIds().forEach(id => {
         ssn = Session.findById(id);
         body.push({id: ssn.id, prsId: ssn.prsId, loginTime: ssn.loginTime});
      });
      res.json(body);
   }
   req.cnn.release();
});

router.post('/', function(req, res) {
   var ssn;
   var cnn = req.cnn;
   var cb = function(){
      res.end();
      cnn.release();
   }

   cnn.chkQry('select * from Person where email = ?', [req.body.email],
   function(err, result) {
      if (req.validator.check(result.length && result[0].password ===
       req.body.password, Tags.badLogin, null, cb)) {
         ssn = new Session(result[0], res);
         res.location(router.baseURL + '/' + ssn.id).end();
         cnn.release();
      }
      
   });
});

router.delete('/:id', function(req, res) {
   var vld = req.validator;
   var ssnId = parseInt(req.params.id);
   var cnn = req.cnn;
   var cb = function(){
      res.end();
      // cnn.release();
   }
   ssn = Session.findById(ssnId);
   if(vld.check(ssn, Tags.notFound, null, cb)){
      
      if(vld.checkPrsOK(ssn.prsId, cb))
         ssn.logOut();
      res.end();
   }
   req.cnn.release();
});

router.get('/:id', function(req, res) {
   var vld = req.validator;
   var ssn = Session.findById(parseInt(req.params.id));
   var cb = function(){
      res.end();
      req.cnn.release();
   }

   if (vld.check(ssn, Tags.notFound, null, cb) && vld.checkPrsOK(ssn.prsId, cb)) {
      res.json({id: ssn.id, prsId: ssn.prsId, loginTime: ssn.loginTime});
      req.cnn.release();
   }

});

module.exports = router;
