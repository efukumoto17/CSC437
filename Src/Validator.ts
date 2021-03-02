import { Session } from "./Session"
import {Response, Request} from 'express';


export class Validator{
    errors: {tag: String; params:String[]}[];
    session: Session;
    res: Response;

    public static Tags: {[key: string]: string} = {
        noPermission: "noPermission",    // Login lacks permission.
        missingField: "missingField",    // Field missing. Params[0] is field name
        badValue: "badValue",            // Bad field value.  Params[0] is field name
        notFound: "notFound",            // Entity not present in DB
        badLogin: "badLogin",            // Email/password combination invalid
        dupEmail: "dupEmail",            // Email duplicates an existing email
        noTerms: "noTerms",              // Acceptance of terms is required.
        forbiddenRole: "forbiddenRole",  // Cannot set to this role
        noOldPwd: "noOldPwd",            // Password change requires old password
        dupTitle: "dupTitle",            // Title duplicates an existing cnv title
        forbiddenField: "forbiddenField",
        oldPwdMismatch: 'oldPwdMismatch',
        dupLike: 'dupLike'
    }

    private static Strings: String[] = [
        "email",
        "firstName",
        "lastName",
        "password",
        "title",
        "content",
    ]
    private static Lengths: {[key: string]: number}= {
        content: 5000,
        title: 80,
        firstName: 30,
        lastName: 50,
        email: 150,
        password:50
    }

    constructor(req: Request, res: Response){
        this.errors = [];
        this.session = req.session;
        this.res = res;
    }   
    
    check(test:boolean, tag:String, params:String[], cb:Function) {
        if (!test)
           this.errors.push({tag: tag, params: params});
     
        if (this.errors.length) {
           if (this.res) {
              if (this.errors[0].tag === Validator.Tags.noPermission)
                 this.res.status(403).end();
              else if(this.errors[0].tag === Validator.Tags.notFound)
                 this.res.status(404).end()
              else
                 this.res.status(400).json(this.errors);
              this.res = null;   // Preclude repeated closings
           }
           if (cb)
              cb(this);
        }
        return !this.errors.length;
    };

    chain(test:boolean, tag:String, params:String[]) {
        if(!params)
           params = null;
        if (!test) {
           this.errors.push({tag: tag, params: params});
        }
        return this;
    };

    checkAdmin(cb:Function) {
        return this.check(this.session && this.session.isAdmin(),
         Validator.Tags.noPermission, null, cb);
    };

    checkPrsOK(prsId:Number, cb:Function) {
        return this.check(this.session &&
         (this.session.isAdmin() || this.session.prsId == prsId),
         Validator.Tags.noPermission, null, cb);
    };

    hasFields(this:Validator, obj:JSON, fieldList:String[], cb:Function) {
        var self = this;
     
        fieldList.forEach(function(name:string) {
           self.chain(obj.hasOwnProperty(name), Validator.Tags.missingField, [name]);
        });
     
        return this.check(true, null, null, cb);
    };

    checkFieldLengths(body:{[key: string]: string}, cb: Function){
        var Lengths: {[key: string]: number} = Validator.Lengths
        for(var val in body){
           if(Lengths.hasOwnProperty(val) && body[val] && Lengths[val] < body[val].length){
              this.errors.push({tag:Validator.Tags.badValue, params: [val] })
           }
        }
        return this.chain(true, null,null);
    };

    checkStrings(body: {[key: string]: string}, cb: Function){
        var Strings: String[] = Validator.Strings;
        for(var val in body){
           if(Strings.includes(val) && typeof val !== 'string'){
              this.errors.push({tag:Validator.Tags.badValue, params: [val] })
           }
        }
        return this.chain(true, null, null);
    };

    hasOnlyFields(obj: {[key: string]: string}, fieldList: String[], cb: Function){
        var self = this;
        var hasFields = Object.keys(obj)
     
        hasFields.forEach(function(name) {
           self.chain(fieldList.includes(name), Validator.Tags.forbiddenField, [name]);
        });
     
        return this.check(true, null, null, cb);
     };
}