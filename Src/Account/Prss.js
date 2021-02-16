var Express = require('express');
var Tags = require('../Validator.js').Tags;
var async = require('async');
var mysql = require('mysql');

var router = Express.Router({caseSensitive: true});

router.baseURL = '/Prss';

/* Much nicer versions
//.../Prss?email=cstaley
router.get('/', function(req, res) {

      
   var email = (req.session.isAdmin() && req.query.email) ||
   (!req.session.isAdmin() && req.session.email);
   
   
   // bug on 12-14
   var cnnConfig = {
      host     : 'localhost',
      user     : 'efukumot',
      password : '3420bows',
      database : 'efukumot'
   };
   
   var cnn = mysql.createConnection(cnnConfig);
   
   if(!req.session.isAdmin() && req.session.email !== req.query.email){
      res.status(200).json([]);
      cnn.destroy();
   }
   else if (email){
      console.log("this branch");
      cnn.query('select id, email from Person where email = ?', [email],
      function(err, result) {
         if (err) {
            res.status(500).json("Failed query");
         }
         else {
            res.status(200).json(result);
         }
         cnn.destroy();
      });
   }else 
      cnn.query('select id, email from Person',
      function(err, result) {
         if (err) {
            console.log("err" + err);
            res.status(500).json("Failed query");
         }
         else {
            res.status(200).json(result);
         }
         cnn.destroy();
      });
});

// Non-waterfall, non-validator, non-db automation version
router.post('/', function(req, res) {
   var body = req.body;
   var admin = req.session && req.session.isAdmin();
   var errorList = [];
   var qry;
   var noPerm;
   var cnnConfig = {
      host     : '127.0.0.1',
      user     : 'efukumot',
      password : '3420bows',
      database : 'efukumot'
   };

   if (admin && !body.password)
      body.password = "*";             // Blocking password
   body.whenRegistered = new Date();

   // Check for fields
   if (!body.hasOwnProperty('email'))
      errorList.push({tag: "missingField", params: "email"});
   if (!body.hasOwnProperty('password'))
      errorList.push({tag: "missingField", params: "password"});
   if(!body.hasOwnProperty('lastName'))
      errorList.push({tag: "missingField", params: "lastName"});
   if (!body.hasOwnProperty('role'))
      errorList.push({tag: "missingField", params: "role"});

   // Do these checks only if all fields are there
   if (!errorList.length) {
      noPerm = body.role === 1 && !admin;
      if (!body.termsAccepted && !admin)
         errorList.push({tag: "noTerms", param: null});
      if (body.role < 0 || body.role > 1)
         errorList.push({tag: "badVal", param: ["role"]}); // bug here for behavior
   }

   // Post errors, or proceed with data fetches
   if (noPerm)
      res.status(403).end();
   else if (errorList.length)
      res.status(400).json(errorList);
   else {
      var cnn = mysql.createConnection(cnnConfig);

      // Find duplicate Email if any.
      cnn.query(qry = 'select * from Person where email = ?', body.email,
      function(err, dupEmail) {
         if (err) {
            console.log(err)
            cnn.destroy();
            res.status(500).json("Failed query " + qry);
         }
         else if (dupEmail.length) {
            res.status(400).json({tag: "dupEmail"});
            cnn.destroy();
         }
         else { // No duplicate, so make a new Person
            body.termsAccepted = body.termsAccepted && new Date();
            cnn.query(qry = 'insert into Person set ?', body,
            function(err, insRes) {
               cnn.destroy();
               console.log(err)
               if (err)
               res.status(500).json("Failed query " + qry);
               else
               res.location(router.baseURL + '/' + insRes.insertId).end();
            });
         }
      });
   }
});

*/
router.get('/', function(req, res) {
   var email = req.session.isAdmin() && req.query.email ||
    !req.session.isAdmin() && req.session.email;

   var handler = function(err, prsArr, fields) {
      res.json(prsArr);
      req.cnn.release();
   };

   if(!req.session.isAdmin() && req.session.email !== req.query.email){
      res.status(200).json([]);
      cnn.destroy();
   }
   else if (email)
      req.cnn.chkQry('select id, email from Person where email = ?', [email], handler);
   else
      req.cnn.chkQry('select id, email from Person', null, handler);
});

router.post('/', function(req, res) {
   var vld = req.validator;  // Shorthands
   var body = req.body;
   var admin = req.session && req.session.isAdmin();
   var cnn = req.cnn;

   if (admin && !body.password)
      body.password = "*";                       // Blocking password
   body.whenRegistered = new Date();


   async.waterfall([
      function(cb) { // Check properties and search for Email duplicates
         if (vld.hasFields(body, ["email", "password","lastName", "role"], cb) &&
          vld.chain(body.role === 0 || admin, Tags.forbiddenRole)
          .chain((body.password && body.password.length > 0) || admin, Tags.missingField, ["password"])
          .chain(body.termsAccepted || admin, Tags.noTerms, null)
          .check(body.role > -1 && body.role < 2, Tags.badValue, ["role"], cb)) {
            cnn.chkQry('select * from Person where email = ?', body.email, cb);
         }
      },
      function(existingPrss, fields, cb) {  // If no dups, insert new Person
         if (vld.check(!existingPrss.length, Tags.dupEmail, null, cb)) {
            body.termsAccepted = body.termsAccepted && new Date();
            cnn.chkQry('insert into Person set ?', [body], cb);
         }
      },
      function(result, fields, cb) { // Return location of inserted Person
         res.location(router.baseURL + '/' + result.insertId).end();
         cb();
      }],
      function(err) { // anchor funciton
         cnn.release();
      }
   );
});

router.put('/:id', function(req, res) {
   var vld = req.validator;
   var ssn = req.session;
   var okFields = ["firstName", "lastName", "password", "role"];
   var body = req.body;
   console.log(body.password)
   console.log(body.password == null )


   async.waterfall([
   cb => {
      if (vld.checkPrsOK(req.params.id, cb) && 
       vld.chain(!('role' in body) || 
        (ssn.isAdmin()&& (body.role > -1 && body.role < 2)), Tags.badValue, ["role"])
      //  .hasOnlyFields(body, okFields)
       .chain(!('termsAccepted' in body), Tags.forbiddenField)
       .chain(!('whenRegistered' in body), Tags.forbiddenField)
       .chain(!('lastName' in body) || body.lastName.length > 0, Tags.badValue, ["lastName"])
       .checkFieldLengths(body)
       .chain(!('password' in body) || body.oldPassword || ssn.isAdmin(), Tags.noOldPwd)
       .check(!('password' in body) || (body.password !== null && body.password.length > 0), Tags.badValue, ["password"], cb))
       req.cnn.chkQry('select * from Person where id = ?', [req.params.id],
       cb);
   },
   (foundPrs, fields, cb) =>{ // add oldpasswordmismatch
      console.log(foundPrs[0].password)
      console.log(req.body.oldPassword)
      if(vld.check(foundPrs.length, Tags.notFound, null, cb) &&
      vld.check(vld.session.isAdmin() || !('password' in body) || 
       (body.oldPassword && body.password), Tags.noOldPwd, cb) &&
      vld.check(vld.session.isAdmin() || !('password' in body) || 
       foundPrs[0].password === req.body.oldPassword, Tags.oldPwdMismatch, null, cb)){
         delete body.oldPassword;
         req.cnn.chkQry('update Person set ? where id = ?', 
         [req.body, req.params.id], cb);
      }
   },
   (updRes, fields, cb) =>{
      cb();
      res.end();
   }
   ],
   err => {
      req.cnn.release();
   })
});

router.get('/:id', function(req, res) {
   var vld = req.validator;
   var ssn = req.session;
   var body = req.body;
   var cnn = req.cnn;

   async.waterfall([
   function(cb) {
     if (vld.checkPrsOK(req.params.id, cb))
        req.cnn.chkQry('select * from Person where id = ?', [req.params.id],
         cb);
   },
   function(prsArr, fields, cb) {
      if (vld.check(prsArr.length, Tags.notFound, null, cb)) {
         delete prsArr[0].password;
         res.json(prsArr);
         cb();
      }
   }],
   err => {
      req.cnn.release();
   });
});

/*
router.get('/:id', function(req, res) {
   var vld = req.validator;

   if (vld.checkPrsOK(req.params.id)) {
      req.cnn.query('select * from Person where id = ?', [req.params.id],
      function(err, prsArr) {
         if (vld.check(prsArr.length, Tags.notFound))
            res.json(prsArr);
         req.cnn.release();
      });
   }
   else {
      req.cnn.release();
   }
});
*/

router.delete('/:id', function(req, res) {
   var vld = req.validator;

   async.waterfall([
   function(cb) {
      if (vld.checkAdmin()) {
         req.cnn.chkQry('DELETE from Person where id = ?', [req.params.id], cb);
      }
   },
   function(result, fields, cb) {
      if (vld.check(result.affectedRows, Tags.notFound, null, cb)) {
         res.end();
         cb();
      }
   }],
   function(err) {
      req.cnn.release();
   });
});

module.exports = router;
