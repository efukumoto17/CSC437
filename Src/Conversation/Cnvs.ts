import {Router, Response, Request} from 'express';
import {waterfall} from 'async';
import {Validator} from '../Validator';
import {queryCallback, FieldInfo, PoolConnection} from 'mysql';

export let router = Router({caseSensitive: true});

const Tags = Validator.Tags;
const baseURL = '/Cnvs';

interface Conversation {
   id: number;
   title: string;
   lastMessage: Date | number;
   ownerId: number;
};

interface InsertReturn {
    insertId: string;
}
// Listing only the fields we actually modify -- just to illustrate
interface Message {
    whenMade: Date | number;
    content: string
}

router.get('/', function(req: Request, res: Response) {
    var prsId: number | String = parseInt(<string>req.query.owner);
    var cnn: PoolConnection = req.cnn;
    var vld: Validator = req.validator;
    if(isNaN(prsId))
       prsId = <string>req.query.owner;
 
    waterfall([
          function(cb: queryCallback){
             var query = 'select * from Conversation'
             if(prsId)
                cnn.chkQry(query + ' where id = ?', [prsId], cb);
             else 
                cnn.chkQry(query, null, cb);
          },
          function(cnvs: {[key: string]: string}[], fields: FieldInfo[], cb: queryCallback){
             res.json(cnvs);
             cb(null);
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
    waterfall([
    function(cb: queryCallback) {
       if(vld.check(body.title, Tags.missingField, ["title"], cb) &&
         vld.checkStrings(body, cb)
          .check(typeof body.title === 'string', Tags.badValue, ["title"], cb) &&
         vld.checkFieldLengths(body, cb))
       cnn.chkQry('select * from Conversation where title = ?', body.title, cb);
    },
    function(existingCnv: {[key: string]: string}[], fields: FieldInfo[], cb: queryCallback) {
       if (vld.check(!existingCnv.length, Tags.dupTitle, null, cb))
          cnn.chkQry("insert into Conversation set ?", body, cb);
    },
    function(insRes: InsertReturn, fields: FieldInfo[], cb: queryCallback) {
       res.location(baseURL + '/' + insRes.insertId).end();
       cb(null);// if you call cb(false) we wont call the finally
    }],
    function() {
       cnn.release();
    });
 });

 router.get('/:cnvId', function(req: Request, res: Response){
    var vld = req.validator;
    var body = req.body;
    var cnn = req.cnn;
    var cnvId = req.params.cnvId;
    
    waterfall([
       function(cb: queryCallback){
          cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
       },
       function(cnv: {[key: string]: string}[], fields: FieldInfo[], cb: queryCallback){
          if(vld.check(cnv.length > 0, Tags.notFound, null, cb)){
             res.json(cnv[0])
             cb(null);
          }
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
    waterfall([
    function(cb: queryCallback) {
       if(vld.check('title' in body && body.title !== "", Tags.missingField, ['title'], cb) &&
        vld.check(body.title !== "", Tags.badValue, ['title'], cb) &&
        vld.checkFieldLengths(body, cb)
        .chain(typeof body.title === 'string', Tags.badValue, ["title"])
        .check(body.title.length > 0, Tags.badValue, ['title'], cb))
       cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
    },
    function(cnvs: {[key: string]: string}[], fields: FieldInfo[], cb: queryCallback) {
       if (vld.check(cnvs.length > 0, Tags.notFound, null, cb) &&
        vld.checkPrsOK(parseInt(cnvs[0].ownerId), cb))// result is a bug
        // <> is not equal to bc its ok to rename to the same name
          cnn.chkQry('select * from Conversation where id <> ? && title = ?',
           [cnvId, body.title], cb);
    },
    function(sameTtl: {[key: string]: string}[], fields: FieldInfo, cb: queryCallback) {
       if (vld.check(!sameTtl.length, Tags.dupTitle, null, cb))
          cnn.chkQry("update Conversation set title = ? where id = ?",
           [body.title, cnvId], cb);
    },
    function(insert: InsertReturn, fields: FieldInfo, cb: queryCallback) {
       res.end();
       cb(null);
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
 
    waterfall([
    function(cb: queryCallback) {
       cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
    },
    function(cnvs: {[key: string]: string}[], fields: FieldInfo, cb: queryCallback) {
       if (vld.check(cnvs.length > 0, Tags.notFound, null, cb) &&
        vld.checkPrsOK(parseInt(cnvs[0].ownerId), cb))// results[] undef here
          cnn.chkQry('delete from Conversation where id = ?', [cnvId], cb);
    },
    function(deleted: {[key: string]: string}[], fields: FieldInfo, cb: queryCallback) {
       cnn.chkQry('delete from Message where cnvId = ?', [cnvId], cb);
    },
    function(deleted: {[key: string]: string}[], fields: FieldInfo, cb: queryCallback){
       res.end();
       cb(null);
    }],
    function(err) {
       // res.status(200).end();
       cnn.release();
    });
 });

 router.get('/:cnvId/Msgs', function(req, res){
    var dateTime = req.query.dateTime;
    var num: number | String = parseInt(<string>req.query.num);
    var cnvId = req.params.cnvId;
    var vld = req.validator;
    var cnn = req.cnn;
    var ret = [];
    if(isNaN(num))
       num = <string>req.query.num
 
    waterfall([
       function(cb: queryCallback) {
          cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb)
       },
       function(cnv: {[key: string]: string}[], fields: FieldInfo, cb: queryCallback){
          if(vld.check(cnv.length > 0, Tags.notFound, null, cb)){
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
       function(msgs: {[key: string]: string}[], fields: FieldInfo, cb: queryCallback) {
          res.json(msgs);
          cb(null);
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
 
    waterfall([
       function(cb: queryCallback){
          if(vld.chain(body.content, Tags.missingField, ["content"]) &&
           vld.chain(typeof body.content === 'string', Tags.badValue, ["content"])
           .checkFieldLengths(body, cb).check(true, null, null, cb))
             cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb)
       },
       function(cnv: {[key: string]: string}[], fields: FieldInfo, cb: queryCallback){
          body.numLikes = 0;
          if(vld.check(cnv.length > 0, Tags.notFound, null, cb))
             cnn.chkQry('insert into Message set ?', body, cb); 
       },
       function(pst: InsertReturn, fields: FieldInfo, cb: queryCallback){
          res.location('/Msgs/' + pst.insertId);
          cnn.chkQry('update Conversation set lastMessage = ? where id = ?', 
           [new Date()/* .getTime() */, cnvId], cb)
       },
       function(updRes: {[key: string]: string}[], fields: FieldInfo, cb: queryCallback){
          res.end();
          cb(null);
       }
    ],
    function(err){
       cnn.release();
       res.end();
    });
 });

 module.exports = router;