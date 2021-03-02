import {Router, Response, Request} from 'express';
import {waterfall} from 'async';
import {Validator} from '../Validator';
import {queryCallback, FieldInfo, MysqlError} from 'mysql'
import {Session} from '../Session'

export var router = Router({caseSensitive: true});
const baseURL = '/Prss';
const Tags = Validator.Tags;

interface Person{
    id?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    whenRegistered?: Date | number;
    role?: number;
}

interface InsertReturn {
    insertId: string;
}

interface DeleteReturn{
    affectedRows: number;
}

interface Message {
    id: number;
    cnvId: number;
    whenMade: Date | number;
    content: string;
    numLikes: number;
    prsId: number;
    email: string;
}

router.get('/', function(req, res) {
    var cnn = req.cnn;
    var email = req.session.isAdmin() && req.query.email ||
     !req.session.isAdmin() && req.session.email;
 
    var handler = function(err: MysqlError | null, prsArr: Person[], fields: FieldInfo[]) {
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
    body.whenRegistered = new Date()/* .getTime(); */
 
    waterfall([
       function(cb: queryCallback) { // Check properties and search for Email duplicates
          if (vld.hasFields(body, ["email", "password","lastName", "role"], cb) &&
           vld.checkFieldLengths(body, cb).check(true, null, null, cb) && 
           vld.checkStrings(body, cb)
           .chain(body.email, Tags.missingField, ["email"])
           .check(body.role !== undefined &&
             body.role !== null, Tags.missingField, ["role"], cb) && 
           vld.chain(body.lastName, Tags.missingField, ["lastName"])
           .chain(body.password, Tags.missingField, ["password"])
           .chain(body.termsAccepted, Tags.missingField, ["termsAccepted"])
           .check(typeof body.role === 'number', Tags.badValue, ["role"], cb) && 
           vld.chain((body.password && body.password.length > 0) || admin, Tags.missingField, ["password"])
           .chain(body.termsAccepted || admin, Tags.noTerms, null)
           .check(body.role > -1 && body.role < 2, Tags.badValue, ["role"], cb) &&
           vld.check(body.role === 0 || admin, Tags.forbiddenRole, null, cb)) {
             cnn.chkQry('select * from Person where email = ?', body.email, cb);
          }
       },
       function(existingPrss: Person[], fields: FieldInfo[], cb: queryCallback) {  // If no dups, insert new Person
          if (vld.check(!existingPrss.length, Tags.dupEmail, null, cb)) {
             body.termsAccepted = body.termsAccepted && new Date()/* .getTime() */;
             cnn.chkQry('insert into Person set ?', [body], cb);
          }
       },
       function(result: InsertReturn, fields: FieldInfo[], cb: queryCallback) { // Return location of inserted Person
          res.location(baseURL + '/' + result.insertId).end();
          cb(null);
       }],
       function(err) { // anchor funciton
          cnn.release();
       }
    );
 });

 router.put('/:id', function(req, res) {
    var vld = req.validator;
    var ssn = req.session;
    var prsId = parseInt(req.params.id);
    var okFields = ["firstName", "lastName", "password","oldPassword", "role"];
    var body = req.body;
 
    waterfall([
    (cb: queryCallback) => {
       if (vld.checkPrsOK(prsId, cb) && 
        vld.checkStrings(body, cb) &&
        vld.hasOnlyFields(body, okFields, cb) &&
        vld.chain(!('role' in body) || body.role === 0 ||
         (ssn.isAdmin() && (body.role > -1 && body.role < 2)), Tags.badValue, ["role"])
        .chain(!('termsAccepted' in body), Tags.forbiddenField, ["termsAccepted"])
        .chain(!('whenRegistered' in body), Tags.forbiddenField, ["whenRegistered"])
        .chain(!('lastName' in body) || body.lastName.length > 0, Tags.badValue, ["lastName"])
        .checkFieldLengths(body, cb)
        .chain(!('password' in body) || body.oldPassword || ssn.isAdmin(), Tags.noOldPwd, null)
        .check(!('password' in body) || (body.password !== null && body.password.length > 0), Tags.badValue, ["password"], cb)){
          req.cnn.chkQry('select * from Person where id = ?', [req.params.id],
           cb);
        }
    },
    (foundPrs: Person[], fields: FieldInfo, cb: queryCallback) =>{ // add oldpasswordmismatch
        if(vld.check(foundPrs.length > 0, Tags.notFound, null, cb) &&
        vld.check(vld.session.isAdmin() || !('password' in body) || 
            (body.oldPassword && body.password), Tags.noOldPwd, null, cb) &&
        vld.check(vld.session.isAdmin() || !('password' in body) || 
            foundPrs[0].password === req.body.oldPassword, Tags.oldPwdMismatch, null, cb)){
          
            delete body.oldPassword;
            if(Object.keys(body).length){
             req.cnn.chkQry('update Person set ? where id = ?', 
             [req.body, req.params.id], cb);
 
            }
            else{
                console.log(cb);
                console.log("cb ")
                res.end();
                cb(null, null, null);
            }
        }
    },
    (updRes: InsertReturn, fields: FieldInfo, cb: queryCallback) =>{
        console.log(cb);
        console.log("cb ")
        cb(null);
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
    var prsId = parseInt(req.params.id);
 
    waterfall([
    function(cb: queryCallback) {
      if (vld.checkPrsOK(prsId, cb))
         req.cnn.chkQry('select * from Person where id = ?', [req.params.id],
          cb);
    },
    function(prsArr: Person[], fields: FieldInfo, cb: queryCallback) {
       if (vld.check(prsArr.length > 0, Tags.notFound, null, cb)) {
          delete prsArr[0].password;
          res.json(prsArr);
          cb(null);
       }
    }],
    err => {
       req.cnn.release();
    });
 });

 router.delete('/:id', function(req, res) {
    var vld = req.validator;
 
    waterfall([
    function(cb: queryCallback) {
       if (vld.checkAdmin(cb)) {
          req.cnn.chkQry('DELETE from Person where id = ?', [req.params.id], cb);
       }
    },
    function(result: DeleteReturn, fields: FieldInfo, cb: queryCallback) {
       if (vld.check(result.affectedRows > 0, Tags.notFound, null, cb)) {
          var ssns = Session.getAllIds();
          ssns.forEach(id => {
             var ssn = Session.findById(id)
             if(ssn.prsId === parseInt(req.params.id)){
                ssn.logOut();
             }
          });
          res.end();
          cb(null);
       }
    }],
    function(err) {
       req.cnn.release();
    });
 });

 router.get('/:prsId/Msgs', function(req, res){
    var prsId = parseInt(req.params.prsId);
    var cnn = req.cnn;
    var vld = req.validator;
    var num: number | string = parseInt(<string>req.query.num);
    if(isNaN(num))
       num = <string>req.query.num;
 
    var order = req.query.order;
    var qryprms: (number | string)[] = [prsId];
 
    waterfall([
       function(cb: queryCallback) {
          cnn.chkQry('select * from Person where id = ?', [prsId], cb);
       },
       function(prs: Person[], fields: FieldInfo, cb: queryCallback){
          if(vld.check(prs.length > 0, Tags.notFound, null, cb)){
             var query = 'select m.id, cnvId, whenMade, email, content, numLikes '
              + 'from Message m join Person p on prsId = p.id '
              + 'where prsId = ? '
             if(order === 'likes')
                query += 'order by numLikes desc'
             if(order === 'date')
                query += 'order by whenMade desc'
             if(num){
                query += ' limit ?'
                qryprms.push(num);
             }
             cnn.chkQry(query , qryprms, cb)
          }
       },
       function(msgs: Message[], fields: FieldInfo, cb: queryCallback){
          res.json(msgs);
          cb(null)
       }
    ],
    function(err){
       cnn.release();
    });
 });

 module.exports = router;