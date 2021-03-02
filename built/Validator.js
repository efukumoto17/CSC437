"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
class Validator {
    constructor(req, res) {
        this.errors = [];
        this.session = req.session;
        this.res = res;
    }
    check(test, tag, params, cb) {
        if (!test)
            this.errors.push({ tag: tag, params: params });
        if (this.errors.length) {
            if (this.res) {
                if (this.errors[0].tag === Validator.Tags.noPermission)
                    this.res.status(403).end();
                else if (this.errors[0].tag === Validator.Tags.notFound)
                    this.res.status(404).end();
                else
                    this.res.status(400).json(this.errors);
                this.res = null; // Preclude repeated closings
            }
            if (cb)
                cb(this);
        }
        return !this.errors.length;
    }
    ;
    chain(test, tag, params) {
        if (!params)
            params = null;
        if (!test) {
            this.errors.push({ tag: tag, params: params });
        }
        return this;
    }
    ;
    checkAdmin(cb) {
        return this.check(this.session && this.session.isAdmin(), Validator.Tags.noPermission, null, cb);
    }
    ;
    checkPrsOK(prsId, cb) {
        return this.check(this.session &&
            (this.session.isAdmin() || this.session.prsId == prsId), Validator.Tags.noPermission, null, cb);
    }
    ;
    hasFields(obj, fieldList, cb) {
        var self = this;
        fieldList.forEach(function (name) {
            self.chain(obj.hasOwnProperty(name), Validator.Tags.missingField, [name]);
        });
        return this.check(true, null, null, cb);
    }
    ;
    checkFieldLengths(body, cb) {
        var Lengths = Validator.Lengths;
        for (var val in body) {
            if (Lengths.hasOwnProperty(val) && body[val] && Lengths[val] < body[val].length) {
                this.errors.push({ tag: Validator.Tags.badValue, params: [val] });
            }
        }
        return this.chain(true, null, null);
    }
    ;
    checkStrings(body, cb) {
        var Strings = Validator.Strings;
        for (var val in body) {
            if (Strings.includes(val) && typeof val !== 'string') {
                this.errors.push({ tag: Validator.Tags.badValue, params: [val] });
            }
        }
        return this.chain(true, null, null);
    }
    ;
    hasOnlyFields(obj, fieldList, cb) {
        var self = this;
        var hasFields = Object.keys(obj);
        hasFields.forEach(function (name) {
            self.chain(fieldList.includes(name), Validator.Tags.forbiddenField, [name]);
        });
        return this.check(true, null, null, cb);
    }
    ;
}
exports.Validator = Validator;
Validator.Tags = {
    noPermission: "noPermission",
    missingField: "missingField",
    badValue: "badValue",
    notFound: "notFound",
    badLogin: "badLogin",
    dupEmail: "dupEmail",
    noTerms: "noTerms",
    forbiddenRole: "forbiddenRole",
    noOldPwd: "noOldPwd",
    dupTitle: "dupTitle",
    forbiddenField: "forbiddenField",
    oldPwdMismatch: 'oldPwdMismatch',
    dupLike: 'dupLike'
};
Validator.Strings = [
    "email",
    "firstName",
    "lastName",
    "password",
    "title",
    "content",
];
Validator.Lengths = {
    content: 5000,
    title: 80,
    firstName: 30,
    lastName: 50,
    email: 150,
    password: 50
};
