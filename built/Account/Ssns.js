"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const Validator_1 = require("../Validator");
const Session_1 = require("../Session");
exports.router = express_1.Router({ caseSensitive: true });
const Tags = Validator_1.Validator.Tags;
const baseURL = '/Ssns';
exports.router.get('/', function (req, res) {
    var body = [], ssn;
    var cb = function () {
        res.end();
    };
    if (req.validator.checkAdmin(cb)) {
        Session_1.Session.getAllIds().forEach(id => {
            ssn = Session_1.Session.findById(id);
            body.push({ id: ssn.id, prsId: ssn.prsId, loginTime: ssn.loginTime });
        });
        res.json(body);
    }
    else {
        res.status(403).end();
    }
    req.cnn.release();
});
exports.router.post('/', function (req, res) {
    var ssn;
    var cnn = req.cnn;
    var cb = function () {
        res.end();
        cnn.release();
    };
    cnn.chkQry('select * from Person where email = ?', [req.body.email], function (err, result) {
        if (req.validator.check(result.length && result[0].password ===
            req.body.password, Tags.badLogin, null, cb)) {
            ssn = new Session_1.Session(result[0], res);
            res.location(baseURL + '/' + ssn.id).end();
            cnn.release();
        }
    });
});
exports.router.delete('/:id', function (req, res) {
    var vld = req.validator;
    var ssnId = parseInt(req.params.id);
    var cnn = req.cnn;
    var cb = function () {
        res.end();
        // cnn.release();
    };
    var ssn = Session_1.Session.findById(ssnId);
    if (vld.check(ssn !== undefined, Tags.notFound, null, cb)) {
        if (vld.checkPrsOK(ssn.prsId, cb))
            ssn.logOut();
        res.end();
    }
    req.cnn.release();
});
exports.router.get('/:id', function (req, res) {
    var vld = req.validator;
    var ssn = Session_1.Session.findById(parseInt(req.params.id));
    var cb = function () {
        res.end();
        req.cnn.release();
    };
    console.log(Session_1.Session.getAllIds());
    if (vld.check(ssn !== undefined, Tags.notFound, null, cb) && vld.checkPrsOK(ssn.prsId, cb)) {
        res.json({ id: ssn.id, prsId: ssn.prsId, loginTime: ssn.loginTime });
        req.cnn.release();
    }
});
module.exports = exports.router;
