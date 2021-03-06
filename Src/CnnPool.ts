import {createPool, Pool, MysqlError, PoolConnection} from 'mysql';
import {Response, Request} from 'express';


export class CnnPool{
    poolCfg: {[key: string]: string};
    pool: Pool;
    
    private static PoolSize = "1"; 
    private static singleton = new CnnPool();
    
    constructor(){
        this.poolCfg = require('../Src/connection.json');
        this.poolCfg.connectionLimit = CnnPool.PoolSize;
        this.pool = createPool(this.poolCfg);
    };

    getConnection(this: CnnPool, cb: (err: MysqlError, connection: PoolConnection) => void){
         this.pool.getConnection(cb);
    };

    static router(req: Request, res: Response, next: Function) {
        console.log("Getting connection");
        CnnPool.singleton.getConnection(function(err, cnn) {
           console.log("get connection")
           if (err){
               console.log("err")
              res.status(500).json('Failed to get connection ' + err);
           }
           else {
              console.log("Connection acquired");
              cnn.chkQry = function(qry, prms, cb) {
                 // Run real qry, checking for error
     
                 this.query(qry, prms, function(err, _ , fields) {
                    if (err){
                       console.log(err);
                       res.status(500).json('Failed query ' + qry);
                    }
                    cb(err, _ , fields);
                 });
              };
              req.cnn = cnn;
              next();
           }
        });
    };

}