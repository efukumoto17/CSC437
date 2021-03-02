import {Router, Response, Request} from 'express';
import {waterfall} from 'async';
import {Validator} from '../Validator';
import {queryCallback, FieldInfo} from 'mysql'

export let router = Router({caseSensitive: true});
const Tags = Validator.Tags;
const baseURL = '/Msgs';

interface GetMsgReturn {
    cnvId?: number;
    prsId?: number;
    whenMade?: Date;
    email?: string;
    content?: string;
    numLikes?: number;
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
interface Like{
    id?: number;
    cnvId?: number;
    prsId?: number;
    msgId?: number;
    whenMade?: Date | number;
    lastName?: string;
    firstName?: string;
}
interface InsertReturn {
    insertId: string;
}

router.get('/:msgId', function(req, res){
    var vld = req.validator;   
    var msgId = parseInt(req.params.msgId);
    var cnn = req.cnn;
    var body = req.body;
    var toSend: GetMsgReturn = {};
    var msg: Message;

    waterfall([
        function(cb: queryCallback) {
            cnn.chkQry('select ms.id, prsId, whenMade, email, content '
             + 'from Message ms join Person p on ms.prsId = p.id '  
             + 'where ms.id = ?', [msgId], cb);
        },
        function(msgs: Message[], fields: FieldInfo[], cb: queryCallback){
            if(vld.check(msgs.length > 0, Tags.notFound, null, cb)){
                msg = msgs[0];
                toSend.cnvId = msg.id;
                toSend.prsId = msg.prsId;
                toSend.whenMade = <Date>msg.whenMade;
                toSend.email = msg.email;
                toSend.content = msg.content;
                cnn.chkQry('select * from Likes where msgId = ?', [msgId], cb);
            }
        }, 
        function(likes: {[key: string]: string}[], fields: FieldInfo[], cb: queryCallback) {
            toSend.numLikes = likes.length;
            res.json(toSend);
            cb(null);
        }
    ],function(cb){
        cnn.release();
    });
});

router.get('/:msgId/Likes', function(req, res){
    var vld = req.validator;
    var msgId: number = parseInt(req.params.msgId);
    var num: number | String = parseInt(<string>req.query.num);
    var cnn = req.cnn;
    if(isNaN(num))
       num = <string>req.query.num

    waterfall([
        function(cb: queryCallback) {
            cnn.chkQry('select * from Message where id = ?', [msgId], cb);
        },
        function(msg: Message[], fields: FieldInfo, cb: queryCallback) {
            if(vld.check(msg.length > 0, Tags.notFound, null, cb)){
                if(num)
                    cnn.chkQry('select lk.id, prsId, firstName, lastName '
                     + 'from `Likes` lk join Person p on lk.prsId = p.id ' 
                     + 'where msgId = ?  order by id desc limit ?',
                    [msgId, num], cb)
                else
                    cnn.chkQry('select lk.id, prsId, firstName, lastName '
                     + 'from `Likes` lk  join Person p ' 
                     + 'on lk.prsId = p.id where msgId = ?  order by id desc',
                    [msgId], cb)
            }
        },
        function(likes: Like[], fields: FieldInfo, cb: queryCallback) {
            likes.sort(function(a,b){
                if(a.lastName < b.lastName)
                    return -1
                if(a.lastName > b.lastName)
                    return 1
                if(a.firstName < b.firstName)
                    return -1
                if(a.firstName > b.firstName)
                    return 1
                return 0;
            });
            res.json(likes);
            cb(null);
        }
    ],
    function(err) {
        cnn.release();
    });
});

router.post('/:msgId/Likes', function(req, res){
    var vld = req.validator;   
    var msgId = parseInt(req.params.msgId);
    var cnn = req.cnn;
    var body = req.body;
    var uId = vld.session.prsId;
    var like: Like = {
        'prsId':uId,
        'msgId':msgId,
        'whenMade': new Date()/* .getTime() */
    }

    waterfall([
        function(cb: queryCallback){
            cnn.chkQry('select * from Message where id = ?', [msgId], cb);
        },
        function(msg: Message[],fields: FieldInfo ,cb: queryCallback){
            if(vld.check(msg.length > 0, Tags.notFound, null, cb)){
                like.cnvId = msg[0].cnvId;
                cnn.chkQry('select * from Likes where msgId = ? and prsId = ?', [msgId,uId], cb);
            }
        },
        function(dupLike: Like[], fields: FieldInfo , cb: queryCallback){
            if(vld.check(!dupLike.length, Tags.dupLike, null, cb)){
                cnn.chkQry('insert into Likes set ?', [like], cb);
            }
        },
        function(result: InsertReturn, fields: FieldInfo, cb: queryCallback){
            res.location('Msgs/' + msgId + '/Likes/' + result.insertId).end();
            cnn.chkQry('update Message set numlikes = numlikes + 1 where id = ?', [msgId], cb);
        },
        function(update: {[key: string]: string}[], fields: FieldInfo, cb: queryCallback){
            cb(null);
        }
    ],
    function(err){
        cnn.release();
    });
});

module.exports = router;