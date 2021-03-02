"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CnnPool = void 0;
const mysql_1 = require("mysql");
class CnnPool {
    constructor() {
        this.poolCfg = require('../Src/connection.json');
        this.poolCfg.connectionLimit = CnnPool.PoolSize;
        this.pool = mysql_1.createPool(this.poolCfg);
    }
    ;
    getConnection(cb) {
        this.pool.getConnection(cb);
    }
    ;
    static router(req, res, next) {
        console.log("Getting connection");
        CnnPool.singleton.getConnection(function (err, cnn) {
            if (err)
                res.status(500).json('Failed to get connection ' + err);
            else {
                console.log("Connection acquired");
                cnn.chkQry = function (qry, prms, cb) {
                    // Run real qry, checking for error
                    this.query(qry, prms, function (err, _, fields) {
                        if (err) {
                            res.status(500).json('Failed query ' + qry);
                        }
                        cb(err, _, fields);
                    });
                };
                req.cnn = cnn;
                next();
            }
        });
    }
    ;
}
exports.CnnPool = CnnPool;
CnnPool.PoolSize = "1";
CnnPool.singleton = new CnnPool();
