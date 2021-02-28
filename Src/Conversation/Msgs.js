var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');
var mysql = require('mysql');

router.baseURL = '/Msgs';

router.get('/:msgId', function(req, res){
    var vld = req.validator;   
    var msgId = parseInt(req.params.msgId);
    var cnn = req.cnn;
    var body = req.body;
    var toSend = {};

    async.waterfall([
        function(cb) {
            cnn.chkQry('select ms.id, prsId, whenMade, email, content '
             + 'from Message ms join Person p on ms.prsId = p.id '  
             + 'where ms.id = ?', msgId, cb);
        },
        function(msg, fields, cb) {
            if(vld.check(msg.length, Tags.notFound, null, cb)){
                var msg = msg[0];
                toSend.cnvId = msg.id;
                toSend.prsId = msg.prsId;
                toSend.whenMade = msg.whenMade;
                toSend.email = msg.email;
                toSend.content = msg.content;
                cnn.chkQry('select * from Likes where msgId = ?', msgId, cb);
            }   
        }, 
        function(likes, fields, cb) {
            toSend.numLikes = likes.length;
            res.json(toSend);
            cb();
        }
    ],function(cb){
        cnn.release();
    });

});

router.get('/:msgId/Likes', function(req, res){
    var vld = req.validator;
    var msgId = req.params.msgId;
    var num = req.query.num;
    var cnn = req.cnn;
    var body = req.body;

    async.waterfall([
        function(cb) {
            cnn.chkQry('select * from Message where id = ?', msgId, cb);
        },
        function(msg, fields, cb) {
            if(vld.check(msg.length, Tags.notFound, null, cb)){
                if(num)
                    cnn.chkQry('select lk.id, prsId, firstName, lastName '
                     + 'from `Likes` lk join Person p on lk.prsId = p.id ' 
                     + 'where msgId = ?  order by id desc limit ?',
                    [msgId, parseInt(num)], cb)
                else
                    cnn.chkQry('select lk.id, prsId, firstName, lastName '
                     + 'from `Likes` lk  join Person p ' 
                     + 'on lk.prsId = p.id where msgId = ?  order by id desc',
                    [msgId], cb)
            }
        },
        function(likes, fields, cb) {
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
            cb();
        }
    ],
    function(err) {
        cnn.release();
    });
});

router.post('/:msgId/Likes', function(req, res){
    var vld = req.validator;   
    var msgId = req.params.msgId;
    var cnn = req.cnn;
    var body = req.body;
    var uId = vld.session.prsId;
    var like = {
        'prsId':uId,
        'msgId':msgId,
        'whenMade': new Date()/* .getTime() */
    }

    async.waterfall([
        function(cb){
            cnn.chkQry('select * from Message where id = ?', [msgId], cb);
        },
        function(msg,fields,cb){
            if(vld.check(msg.length, Tags.notFound, null, cb)){
                like.cnvId = msg[0].cnvId;
                cnn.chkQry('select * from Likes where msgId = ? and prsId = ?', [msgId,uId], cb);
            }
        },
        function(dupLike, fields, cb){
            if(vld.check(!dupLike.length, Tags.dupLike, null, cb)){
                cnn.chkQry('insert into Likes set ?', like, cb);
            }
        },
        function(result, fields, cb){
            res.location('Msgs/' + msgId + '/Likes/' + result.insertId).end();
            cnn.chkQry('update Message set numlikes = numlikes + 1 where id = ?', msgId, cb);
        },
        function(update, fields, cb){
            cb();
        }
    ],
    function(err){
        cnn.release();
    });
});

module.exports = router;