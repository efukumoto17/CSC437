import {Router, Response, Request} from 'express';
import {waterfall} from 'async';
import {Validator} from '../Validator';
import {queryCallback, FieldInfo, PoolConnection} from 'mysql';
import {Session} from '../Session'

export let router = Router({caseSensitive: true});
const Tags = Validator.Tags;
const baseURL = '/Ssns';

interface Ssn{
    id: number;
    prsId: number;
    loginTime: number;
}

router.get('/', function(req, res) {
    var body: Ssn[] = [], ssn;
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
          res.location(baseURL + '/' + ssn.id).end();
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
    var ssn = Session.findById(ssnId);
    if(vld.check(ssn !== undefined, Tags.notFound, null, cb)){
       
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
 
    if (vld.check(ssn!== undefined, Tags.notFound, null, cb) && vld.checkPrsOK(ssn.prsId, cb)) {
       res.json({id: ssn.id, prsId: ssn.prsId, loginTime: ssn.loginTime});
       req.cnn.release();
    }
 
 });

 module.exports = router;