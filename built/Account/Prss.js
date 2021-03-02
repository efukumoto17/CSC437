"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const async_1 = require("async");
const Validator_1 = require("../Validator");
const Session_1 = require("../Session");
exports.router = express_1.Router({ caseSensitive: true });
const baseURL = '/Prss';
const Tags = Validator_1.Validator.Tags;
exports.router.get('/', function (req, res) {
    var cnn = req.cnn;
    var email = req.session.isAdmin() && req.query.email ||
        !req.session.isAdmin() && req.session.email;
    var handler = function (err, prsArr, fields) {
        res.json(prsArr);
        req.cnn.release();
    };
    if (!req.session.isAdmin() && req.session.email !== req.query.email) {
        res.status(200).json([]);
        cnn.destroy();
    }
    else if (email)
        req.cnn.chkQry('select id, email from Person where email = ?', [email], handler);
    else
        req.cnn.chkQry('select id, email from Person', null, handler);
});
exports.router.post('/', function (req, res) {
    var vld = req.validator; // Shorthands
    var body = req.body;
    var admin = req.session && req.session.isAdmin();
    var cnn = req.cnn;
    if (admin && !body.password)
        body.password = "*"; // Blocking password
    body.whenRegistered = new Date(); /* .getTime(); */
    async_1.waterfall([
        function (cb) {
            if (vld.hasFields(body, ["email", "password", "lastName", "role"], cb) &&
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
        function (existingPrss, fields, cb) {
            if (vld.check(!existingPrss.length, Tags.dupEmail, null, cb)) {
                body.termsAccepted = body.termsAccepted && new Date() /* .getTime() */;
                cnn.chkQry('insert into Person set ?', [body], cb);
            }
        },
        function (result, fields, cb) {
            res.location(baseURL + '/' + result.insertId).end();
            cb(null);
        }
    ], function (err) {
        cnn.release();
    });
});
exports.router.put('/:id', function (req, res) {
    var vld = req.validator;
    var ssn = req.session;
    var prsId = parseInt(req.params.id);
    var okFields = ["firstName", "lastName", "password", "oldPassword", "role"];
    var body = req.body;
    async_1.waterfall([
        (cb) => {
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
                    .check(!('password' in body) || (body.password !== null && body.password.length > 0), Tags.badValue, ["password"], cb)) {
                req.cnn.chkQry('select * from Person where id = ?', [req.params.id], cb);
            }
        },
        (foundPrs, fields, cb) => {
            if (vld.check(foundPrs.length > 0, Tags.notFound, null, cb) &&
                vld.check(vld.session.isAdmin() || !('password' in body) ||
                    (body.oldPassword && body.password), Tags.noOldPwd, null, cb) &&
                vld.check(vld.session.isAdmin() || !('password' in body) ||
                    foundPrs[0].password === req.body.oldPassword, Tags.oldPwdMismatch, null, cb)) {
                delete body.oldPassword;
                if (Object.keys(body).length) {
                    req.cnn.chkQry('update Person set ? where id = ?', [req.body, req.params.id], cb);
                }
                else {
                    console.log(cb);
                    console.log("cb ");
                    res.end();
                    cb(null, null, null);
                }
            }
        },
        (updRes, fields, cb) => {
            console.log(cb);
            console.log("cb ");
            cb(null);
            res.end();
        }
    ], err => {
        req.cnn.release();
    });
});
exports.router.get('/:id', function (req, res) {
    var vld = req.validator;
    var ssn = req.session;
    var body = req.body;
    var cnn = req.cnn;
    var prsId = parseInt(req.params.id);
    async_1.waterfall([
        function (cb) {
            if (vld.checkPrsOK(prsId, cb))
                req.cnn.chkQry('select * from Person where id = ?', [req.params.id], cb);
        },
        function (prsArr, fields, cb) {
            if (vld.check(prsArr.length > 0, Tags.notFound, null, cb)) {
                delete prsArr[0].password;
                res.json(prsArr);
                cb(null);
            }
        }
    ], err => {
        req.cnn.release();
    });
});
exports.router.delete('/:id', function (req, res) {
    var vld = req.validator;
    async_1.waterfall([
        function (cb) {
            if (vld.checkAdmin(cb)) {
                req.cnn.chkQry('DELETE from Person where id = ?', [req.params.id], cb);
            }
        },
        function (result, fields, cb) {
            if (vld.check(result.affectedRows > 0, Tags.notFound, null, cb)) {
                var ssns = Session_1.Session.getAllIds();
                ssns.forEach(id => {
                    var ssn = Session_1.Session.findById(id);
                    if (ssn.prsId === parseInt(req.params.id)) {
                        ssn.logOut();
                    }
                });
                res.end();
                cb(null);
            }
        }
    ], function (err) {
        req.cnn.release();
    });
});
exports.router.get('/:prsId/Msgs', function (req, res) {
    var prsId = parseInt(req.params.prsId);
    var cnn = req.cnn;
    var vld = req.validator;
    var num = parseInt(req.query.num);
    if (isNaN(num))
        num = req.query.num;
    var order = req.query.order;
    var qryprms = [prsId];
    async_1.waterfall([
        function (cb) {
            cnn.chkQry('select * from Person where id = ?', [prsId], cb);
        },
        function (prs, fields, cb) {
            if (vld.check(prs.length > 0, Tags.notFound, null, cb)) {
                var query = 'select m.id, cnvId, whenMade, email, content, numLikes '
                    + 'from Message m join Person p on prsId = p.id '
                    + 'where prsId = ? ';
                if (order === 'likes')
                    query += 'order by numLikes desc';
                if (order === 'date')
                    query += 'order by whenMade desc';
                if (num) {
                    query += ' limit ?';
                    qryprms.push(num);
                }
                cnn.chkQry(query, qryprms, cb);
            }
        },
        function (msgs, fields, cb) {
            res.json(msgs);
            cb(null);
        }
    ], function (err) {
        cnn.release();
    });
});
module.exports = exports.router;
