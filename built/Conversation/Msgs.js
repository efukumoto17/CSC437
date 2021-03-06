"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const async_1 = require("async");
const Validator_1 = require("../Validator");
exports.router = express_1.Router({ caseSensitive: true });
const Tags = Validator_1.Validator.Tags;
const baseURL = '/Msgs';
exports.router.get('/:msgId', function (req, res) {
    var vld = req.validator;
    var msgId = parseInt(req.params.msgId);
    var cnn = req.cnn;
    var body = req.body;
    var toSend = {};
    var msg;
    async_1.waterfall([
        function (cb) {
            cnn.chkQry('select ms.id, prsId, whenMade, email, content '
                + 'from Message ms join Person p on ms.prsId = p.id '
                + 'where ms.id = ?', [msgId], cb);
        },
        function (msgs, fields, cb) {
            if (vld.check(msgs.length > 0, Tags.notFound, null, cb)) {
                msg = msgs[0];
                toSend.cnvId = msg.id;
                toSend.prsId = msg.prsId;
                toSend.whenMade = new Date(msg.whenMade).getTime();
                toSend.email = msg.email;
                toSend.content = msg.content;
                cnn.chkQry('select * from Likes where msgId = ?', [msgId], cb);
            }
        },
        function (likes, fields, cb) {
            toSend.numLikes = likes.length;
            res.json(toSend);
            cb(null);
        }
    ], function (cb) {
        cnn.release();
    });
});
exports.router.get('/:msgId/Likes', function (req, res) {
    var vld = req.validator;
    var msgId = parseInt(req.params.msgId);
    var num = parseInt(req.query.num);
    var cnn = req.cnn;
    if (isNaN(num))
        num = req.query.num;
    async_1.waterfall([
        function (cb) {
            cnn.chkQry('select * from Message where id = ?', [msgId], cb);
        },
        function (msg, fields, cb) {
            if (vld.check(msg.length > 0, Tags.notFound, null, cb)) {
                if (num)
                    cnn.chkQry('select lk.id, prsId, firstName, lastName '
                        + 'from `Likes` lk join Person p on lk.prsId = p.id '
                        + 'where msgId = ?  order by id desc limit ?', [msgId, num], cb);
                else
                    cnn.chkQry('select lk.id, prsId, firstName, lastName '
                        + 'from `Likes` lk  join Person p '
                        + 'on lk.prsId = p.id where msgId = ?  order by id desc', [msgId], cb);
            }
        },
        function (likes, fields, cb) {
            likes.sort(function (a, b) {
                if (a.lastName < b.lastName)
                    return -1;
                if (a.lastName > b.lastName)
                    return 1;
                if (a.firstName < b.firstName)
                    return -1;
                if (a.firstName > b.firstName)
                    return 1;
                return 0;
            });
            res.json(likes);
            cb(null);
        }
    ], function (err) {
        cnn.release();
    });
});
exports.router.post('/:msgId/Likes', function (req, res) {
    var vld = req.validator;
    var msgId = parseInt(req.params.msgId);
    var cnn = req.cnn;
    var body = req.body;
    var uId = vld.session.prsId;
    var like = {
        'prsId': uId,
        'msgId': msgId,
        'whenMade': new Date() /* .getTime() */
    };
    async_1.waterfall([
        function (cb) {
            cnn.chkQry('select * from Message where id = ?', [msgId], cb);
        },
        function (msg, fields, cb) {
            if (vld.check(msg.length > 0, Tags.notFound, null, cb)) {
                like.cnvId = msg[0].cnvId;
                cnn.chkQry('select * from Likes where msgId = ? and prsId = ?', [msgId, uId], cb);
            }
        },
        function (dupLike, fields, cb) {
            if (vld.check(!dupLike.length, Tags.dupLike, null, cb)) {
                cnn.chkQry('insert into Likes set ?', [like], cb);
            }
        },
        function (result, fields, cb) {
            res.location('Msgs/' + msgId + '/Likes/' + result.insertId).end();
            cnn.chkQry('update Message set numlikes = numlikes + 1 where id = ?', [msgId], cb);
        },
        function (update, fields, cb) {
            cb(null);
        }
    ], function (err) {
        cnn.release();
    });
});
module.exports = exports.router;
