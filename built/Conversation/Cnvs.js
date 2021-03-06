"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const async_1 = require("async");
const Validator_1 = require("../Validator");
exports.router = express_1.Router({ caseSensitive: true });
const Tags = Validator_1.Validator.Tags;
const baseURL = '/Cnvs';
;
exports.router.get('/', function (req, res) {
    var prsId = parseInt(req.query.owner);
    var cnn = req.cnn;
    var vld = req.validator;
    if (isNaN(prsId))
        prsId = req.query.owner;
    async_1.waterfall([
        function (cb) {
            var query = 'select * from Conversation';
            if (prsId)
                cnn.chkQry(query + ' where ownerId = ?', [prsId], cb);
            else
                cnn.chkQry(query, null, cb);
        },
        function (cnvs, fields, cb) {
            cnvs.forEach((cnvs) => {
                cnvs.lastMessage = cnvs.lastMessage ? new Date(cnvs.lastMessage).getTime() : null;
            });
            res.json(cnvs);
            cb(null);
        }
    ], function (err) {
        cnn.release();
    });
});
exports.router.post('/', function (req, res) {
    var vld = req.validator;
    var body = req.body;
    var cnn = req.cnn;
    body.ownerId = vld.session.prsId;
    // need to check title length
    async_1.waterfall([
        function (cb) {
            if (vld.check(body.title, Tags.missingField, ["title"], cb) &&
                vld.checkStrings(body, cb)
                    .check(typeof body.title === 'string', Tags.badValue, ["title"], cb) &&
                vld.checkFieldLengths(body, cb))
                cnn.chkQry('select * from Conversation where title = ?', body.title, cb);
        },
        function (existingCnv, fields, cb) {
            if (vld.check(!existingCnv.length, Tags.dupTitle, null, cb))
                cnn.chkQry("insert into Conversation set ?", body, cb);
        },
        function (insRes, fields, cb) {
            res.location(baseURL + '/' + insRes.insertId).end();
            cb(null); // if you call cb(false) we wont call the finally
        }
    ], function () {
        cnn.release();
    });
});
exports.router.get('/:cnvId', function (req, res) {
    var vld = req.validator;
    var body = req.body;
    var cnn = req.cnn;
    var cnvId = req.params.cnvId;
    async_1.waterfall([
        function (cb) {
            cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
        },
        function (cnv, fields, cb) {
            if (vld.check(cnv.length > 0, Tags.notFound, null, cb)) {
                cnv[0].lastMessage = cnv[0].lastMessage ? new Date(cnv[0].lastMessage).getTime() : null;
                res.json(cnv[0]);
                cb(null);
            }
        }
    ], function (err) {
        cnn.release();
    });
});
exports.router.put('/:cnvId', function (req, res) {
    var vld = req.validator;
    var body = req.body;
    var cnn = req.cnn;
    var cnvId = req.params.cnvId;
    async_1.waterfall([
        function (cb) {
            if (vld.check('title' in body && body.title !== "", Tags.missingField, ['title'], cb) &&
                vld.check(body.title !== "", Tags.badValue, ['title'], cb) &&
                vld.checkFieldLengths(body, cb)
                    .chain(typeof body.title === 'string', Tags.badValue, ["title"])
                    .check(body.title.length > 0, Tags.badValue, ['title'], cb))
                cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
        },
        function (cnvs, fields, cb) {
            if (vld.check(cnvs.length > 0, Tags.notFound, null, cb) &&
                vld.checkPrsOK(parseInt(cnvs[0].ownerId), cb)) // result is a bug
                // <> is not equal to bc its ok to rename to the same name
                cnn.chkQry('select * from Conversation where id <> ? && title = ?', [cnvId, body.title], cb);
        },
        function (sameTtl, fields, cb) {
            if (vld.check(!sameTtl.length, Tags.dupTitle, null, cb))
                cnn.chkQry("update Conversation set title = ? where id = ?", [body.title, cnvId], cb);
        },
        function (insert, fields, cb) {
            res.end();
            cb(null);
        }
    ], function (err) {
        cnn.release();
    });
});
exports.router.delete('/:cnvId', function (req, res) {
    var vld = req.validator;
    var cnvId = req.params.cnvId;
    var cnn = req.cnn;
    var body = req.body;
    async_1.waterfall([
        function (cb) {
            cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
        },
        function (cnvs, fields, cb) {
            if (vld.check(cnvs.length > 0, Tags.notFound, null, cb) &&
                vld.checkPrsOK(parseInt(cnvs[0].ownerId), cb)) // results[] undef here
                cnn.chkQry('delete from Conversation where id = ?', [cnvId], cb);
        },
        function (deleted, fields, cb) {
            cnn.chkQry('delete from Message where cnvId = ?', [cnvId], cb);
        },
        function (deleted, fields, cb) {
            res.end();
            cb(null);
        }
    ], function (err) {
        cnn.release();
    });
});
exports.router.get('/:cnvId/Msgs', function (req, res) {
    var dateTime = new Date(parseInt(req.query.dateTime));
    var num = parseInt(req.query.num);
    var cnvId = req.params.cnvId;
    var vld = req.validator;
    var cnn = req.cnn;
    console.log(new Date(dateTime));
    if (isNaN(num))
        num = req.query.num;
    async_1.waterfall([
        function (cb) {
            cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
        },
        function (cnv, fields, cb) {
            if (vld.check(cnv.length > 0, Tags.notFound, null, cb)) {
                if (num && dateTime)
                    cnn.chkQry('select m.id, prsId, numLikes, whenMade, email, content '
                        + 'from Conversation c join Message m on cnvId = c.id '
                        + 'join Person p on prsId = p.id where c.id = ? '
                        + 'where whenMade < ? order by whenMade , id limit ?', [cnvId, dateTime, num], cb);
                else if (num)
                    cnn.chkQry('select m.id, prsId, numLikes, whenMade, email, content '
                        + 'from Conversation c join Message m on cnvId = c.id '
                        + 'join Person p on prsId = p.id where c.id = ? '
                        + 'order by whenMade, id limit ?', [cnvId, num], cb);
                else if (dateTime)
                    cnn.chkQry('select m.id, prsId, numLikes, whenMade, email, content '
                        + 'from Conversation c join Message m on cnvId = c.id '
                        + 'join Person p on prsId = p.id where c.id = ? '
                        + 'order by whenMade where whenMade < ?', [cnvId, dateTime], cb);
                else
                    cnn.chkQry('select m.id, prsId, numLikes, whenMade, email, content '
                        + 'from Conversation c join Message m on cnvId = c.id '
                        + 'join Person p on prsId = p.id where c.id = ? '
                        + 'order by whenMade, id', [cnvId], cb);
            }
        },
        function (msgs, fields, cb) {
            msgs.forEach((msg) => {
                msg.whenMade = new Date(msg.whenMade).getTime();
            });
            res.json(msgs);
            cb(null);
        }
    ], function (err) {
        cnn.release();
    });
});
exports.router.post('/:cnvId/Msgs', function (req, res) {
    var vld = req.validator;
    var cnvId = req.params.cnvId;
    var cnn = req.cnn;
    var body = req.body;
    body.whenMade = new Date();
    body.prsId = vld.session.prsId;
    body.cnvId = cnvId;
    async_1.waterfall([
        function (cb) {
            if (vld.chain(body.content, Tags.missingField, ["content"]) &&
                vld.chain(typeof body.content === 'string', Tags.badValue, ["content"])
                    .checkFieldLengths(body, cb).check(true, null, null, cb))
                cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
        },
        function (cnv, fields, cb) {
            body.numLikes = 0;
            if (vld.check(cnv.length > 0, Tags.notFound, null, cb))
                cnn.chkQry('insert into Message set ?', body, cb);
        },
        function (pst, fields, cb) {
            res.location('/Msgs/' + pst.insertId);
            cnn.chkQry('update Conversation set lastMessage = ? where id = ?', [new Date() /* .getTime() */, cnvId], cb);
        },
        function (updRes, fields, cb) {
            res.end();
            cb(null);
        }
    ], function (err) {
        cnn.release();
        res.end();
    });
});
module.exports = exports.router;
