app.service('websql', ['$q', '$interpolate', function($q, $interpolate){

    var exist = {}
    var jar = window.jar = new WeakMap();

var importFn = function(data) {
    var db = openDatabase(data.name, "", "", "");
    var cb = function(){};

    if(typeof data.callback === "string"){
        cb = window[data.callback]
    }

    if(typeof data.callback === "function"){
        cb = data.callback
    }

    function versionChangeError(err){
        console.error("Error changing database version!", err);
    }

    function versionChangeComplete(){
        console.info("Version change complete");
        cb();
    }

    function versionChangeMigration(tx){
        data.tables.forEach(function(table){

            function transactionComplete(){
                console.info(table.schema.sql)
            }

            function transactionError(err){
                console.error("Failed to execute", table.schema.sql, err)
            }

            tx.executeSql(table.schema.sql, [], transactionComplete, transactionError);
            table.content.forEach(function(row){
                function transactionComplete(){
                    console.info(table.schema.sql)
                }

                function transactionError(err){
                    console.error("Failed to execute", table.schema.sql, err)
                }

                tx.executeSql(table.sqlStatement, row, transactionComplete, transactionError);
            });
        });
    }

    db.changeVersion(db.version, data.version, versionChangeMigration, versionChangeError, versionChangeComplete);

}

    class Websql {
        constructor(database){
            this.name = database;
            this.tables = [];

            var privateProperties = {
                versions: [],
                db: null
            };

            jar.set(this, privateProperties);
        }

        version(n, fn) {
            jar.get(this).versions.push([n, fn]);
        }

        open() {
            window.db = this;
            // empty version string means "I don't care what version the db is"
            var self = this;
            var db = openDatabase(this.name, "", "", "");
            var _private = jar.get(this);
            _private.db = db

            if(db.version == "" && !_private.versions.length){
                return $q.reject("Database "+ this.name +" doesn't exist");
            } else if(db.version == ""){
                return version(db, _private.versions).then(function(){
                    return self.open()
                });
            }

            this.v = db.version;

            var sqlite_master_AST;
            var sqlite_master_SQL = "CREATE TABLE sqlite_master (type text, name text, tpl_name text, rootpage integer, sql text)";

            sqliteParser(sqlite_master_SQL, (err, res) => {
                sqlite_master_AST = res.statement[0];
            });
            console.log(sqlite_master_AST);
            // sqlResource(url, [paramDefaults], [actions], options);
            var sqlite_master = new WriteableTable("sqlite_master", this, "CREATE TABLE sqlite_master (type, name, tbl_name, rootpage, sql)", sqlite_master_AST);

            this.tables.push(sqlite_master);

            var self = this;

            return sqlite_master.query('SELECT *, sqlite_version() as sqlite_version FROM sqlite_master').toArray(function(r){

                // var db = new SQL.Database();

                r.forEach(function(item){
                    Websql.sqlite_version = self.sqlite_version = item.sqlite_version;

                    // could do this check in the query
                    // but i want to retrive the sqlite_version
                    if(item.type !== 'table' || item.name.startsWith("__")) return;


                    sqliteParser(item.sql, function(err, res){
                        if(err) return;

                        var table = new WriteableTable(item.name, self, item.sql, res.statement[0]);
                        self.tables.push(table);
                    });

                });

                db = null;
            }).then(function(){
                return self;
            })
        }

        close() {
            var _private = jar.get(this);
            _private.db = null;
        }

        changeVersion(ver){
            var self = this;
            var db = this.backendDB();
            self.v = ver;

            return $q(function(resolve, reject){
                db.changeVersion(db.version, ver, null, reject, resolve);
            });
        }

        table(name){
            return this.tables.find(function(table){
                return table.name === name;
            }) || new Error("Table does not exist");
        }

        rename(name){
            var db = this;
            return $q(function(resolve, reject){
                db.export({name: name}, resolve).then(function(importFn){
                    db.delete().then(function(){
                        importFn();
                    });
                });
            });
        }

        get writeableTables() {
            return this.tables.filter(function(table){
                return table.name !== 'sqlite_master';
            });
        }

        exist() {
            return $q(function(resolve, reject){
                DBexist(resolve, reject, name);
            });
        }

        dropTable(name){
            return this.table(name).drop();
        }

        delete() {
            var db = this;

            return $q.all(this.writeableTables.map(table => {
                arrayRemove(db.tables, table);
                return table.drop();
            })).then(function(){
                return db.changeVersion("")
            })
        }

        export(override, callback, stringify) {
            var version = this.backendDB().version;
            var tables = this.writeableTables;
            var db = this;

            return Dexie.Promise.all(tables.map(t => {
                var columns = Object.keys(t.schema.columnsByName);
                // var n = "?,".repeat(columns.length).slice(0,-1);
                var n = Array(columns.length).fill("?")+"";

                return t.toArray().then(function(rows){
                    rows = rows.map(function(row){
                        var args = [];
                        columns.forEach(function(col){
                            args.push(row[col])
                        });
                        return args;
                    });

                    if(override.format == "sqlite"){
                        var sql = `INSERT INTO ${JSON.stringify(t.name)} (${JSON.stringify(columns).slice(1, -1)}) VALUES `;

                        return rows.reduce(function(prev, next){
                            var values = '(' + JSON.stringify(next).slice(1, -1) + ');\n';
                            return prev + sql + values
                        }, t.schema.sql + ";\n");

                    }

                    return {
                        name: t.name,
                        content: rows,
                        schema: t.schema,
                        sqlStatement: `INSERT INTO ${JSON.stringify(t.name)} (${JSON.stringify(columns).slice(1, -1)}) VALUES (${n})`
                    }
                });

            })).then(function(result){

                if(override.format == "sqlite") return result.join("\n\n");

                result = {
                    name: override.name || db.name,
                    version: override.version || version,
                    tables: result
                }

                callback && (result.callback = callback);

                return stringify ? asyncJSON.stringify(result).then(function(result) {
                    return ";("+importFn.toString()+")("+result+")";
                }) : importFn.bind(undefined, result);

            });

        }

        backendDB() {
            return jar.get(this).db
        }

        addTable(name, config) {
            this.transaction("rw", function(t){
                t.executeSql(`CREATE table ${name}`);
            })
        }

        transaction(mode, fn, fn2){
            var _private = jar.get(this);

            var db = _private.db;

            return $q(function(resolve, reject){
                db[mode == "r" ? "readTransaction" : "transaction"](fn, reject, resolve)
            })
        }

        copy(name, version){
            var db = this;
            return $q(function(resolve, reject){
                db.export({version: version, name: name}, resolve).then(function(result){
                    result()
                });
            });
        }
    }

    function doMigration(resolve, reject, db, entries) {
        var next = entries.next();
        if(next.done) return resolve();

        var err = function(){
            reject()
        }

        var suc = function(){
            doMigration(resolve, reject, db, entries);
        }

        db.changeVersion(db.version, next.value[1][0] + "", next.value[1][1] || angular.noop, err, suc);
    };

    function version(db, versions){
        var initialVersion = db.version;
        var iterator = versions.entries();

        // for (var i = iterator.next(); !i.done && i.value[1] !== initialVersion &&; i = iterator.next());

        return $q(function(resolve, reject){
            doMigration(resolve, reject, db, iterator);
        })
    };


    function DBexist(resolve, reject, name) {
        var db = openDatabase(name, "", "", "");

        if(db.version == "" && exist[name] == false){
            // might not exist, You are still able to use "" as version
            // TODO: Check if it 3tains any tables
            resolve(false);
            exist[name] = false;
        } else {
            exist[name] = true;
            resolve(true);
        }
    }


    class WhereClause {
        constructor(table, query, args) {

            this._ctx = arguments.length == 1 ? table : {
                query: query,
                table: table,
                args: args || []
            };
        }

        equals(comparitor){
            this._ctx.query += " = ?";
            this._ctx.args.push(comparitor);

            return new WhereClause(this._ctx);
        }

        and(expression){
            this._ctx.query += " AND " + expression;
            return new WhereClause(this._ctx);
        }

        escape(comparitor){
            this._ctx.args.push(comparitor);
            this._ctx.query += " ESCAPE ?";

            return new WhereClause(this._ctx);
        }

        notLike(comparitor){
            this._ctx.args.push(comparitor);
            this._ctx.query += " NOT LIKE ?";

            return new WhereClause(this._ctx);
        }

        limit(n){
            this._ctx.query += " LIMIT "+n;
            return new WhereClause(this._ctx);
        }

        offset(n){
            this._ctx.query += " OFFSET "+n;
            return new WhereClause(this._ctx);
        }

        toObjectArray(n){
            return this.toArray().then(function(rows){
                return rows.map(function(row){
                    var key = row.rowid
                    delete row.rowid;
                    return {key: key, value: row}
                });
            });
        }

        toArray(cb){
            var self = this;

            return $q(function(resolve, reject){
                self._ctx.table.instance.transaction("r", function(t){
                    t.executeSql(self._ctx.query, self._ctx.args, function(t, result){
                        if(cb) cb(result.rows);
                        resolve(result.rows);
                    });
                }).catch(function(e){
                    console.log(e);
                });
            })
        }
    }

    class WriteableTable {

        constructor(name, instance, sql, schema) {

            var table = this;
            table.name = name
            table.nRows = 0
            table.schema = {
                columnsByName: {rowid: {name: 'rowid'}},
                columns: [{name: 'rowid'}],
                primKey: {
                    keyPath: "rowid",
                    auto: true
                },
                sql: sql
            };
            table.instance = instance


            schema.definition.map(definition => {
                var column = {
                    name: definition.name,
                    notNull: false,
                    primKey: false,
                    unique: false,
                    default: undefined,
                    type: definition.datatype.variant
                }



                definition.definition.forEach(function(def){
                    if(def.variant === "not null"){
                        column.notNull = true
                    } else if(def.variant === "foreign key") {
                        // TODO: Find a usecase
                    } else if(def.variant === "default") {
                        if(def.value.variant === "null"){
                            column.default = null;
                        } else if(def.value.variant === "decimal"){
                            column.default = parseFloat(def.value.value)
                        } else {
                            console.log("TODO default variant:", def.value, sql);
                        }
                    } else if(def.variant === "unique") {
                        column.unique = true;
                    } else if(def.variant === "check") {
                        // TODO: Find a usecase
                    } else if(def.variant === "primary key") {
                        column.primKey = true;
                        table.schema.columns.splice(0, 1); // remove rowid
                        delete table.schema.columnsByName.rowid; // remove rowid
                        table.schema.primKey.keyPath = column.name;
                    } else {
                        console.log("TODO: ", def, sql);
                    }
                });

                table.schema.columns.push(column);
                table.schema.columnsByName[column.name] = column;
            });

        }

        /**
         * drops the table and recreate it
         * Also resets the count
         */
        clear(){
            var schema = this.schema.sql;
            var name = this.name;
            this.nRows = 0;

            return this.instance.transaction("rw", function(tx){
                tx.executeSql(`DROP TABLE ${name} IF EXISTS`);
                tx.executeSql(schema);
            })
        }

        /**
         * Drops a table and removes it from the list
         * @return promise
         */
        drop(keep){
            var name = this.name;
            !keep && arrayRemove(this.instance.tables, this);
            return this.instance.transaction("rw", function(tx){
                tx.executeSql(`DROP TABLE ${name} IF EXISTS`);
            });
        }

        toArray(){
            var self = this;
            var def = this.schema.primKey.keyPath === "rowid" ? 'rowid, *' : '*';

            return $q(function(resolve){
                self.instance.transaction("r", function(t){
                    t.executeSql(`select ${def} from ${self.name}`, [], function(tx, result){
                        resolve(Array.from(result.rows));
                    });
                });
            });
        }

        count(){
            var self = this;
            return $q(function(resolve){
                self.instance.transaction("r", function(t){
                    t.executeSql(`select count() as nRows from ${self.name}`, [], function(tx, result){
                        resolve(result.rows[0].nRows);
                    });
                });
            });
        }

        offset(n){
            var def = this.schema.primKey.keyPath === "rowid" ? 'rowid, *' : '*';
            return new WhereClause(this, `SELECT ${def} FROM ${this.name} OFFSET ${n}`);
        }

        query(sql){
            return new WhereClause(this, sql);
        }

        limit(n){
            var def = this.schema.primKey.keyPath === "rowid" ? 'rowid, *' : '*';
            return new WhereClause(this, `SELECT ${def} FROM ${this.name} LIMIT ${n}`);
        }

        where(indexName){
            var def = this.schema.primKey.keyPath === "rowid" ? 'rowid, *' : '*';
            return new WhereClause(this, `SELECT ${def} FROM ${this.name} WHERE ${indexName}`);
        }

        delete(id){
            var self = this;
            // /// <param name="key">Primary key of the object to delete</param>
            // if (this.hook.deleting.subscribers.length) {
            //     // People listens to when("deleting") event. Must implement delete using WriteableCollection.delete() that will
            //     // call the CRUD event. Only WriteableCollection.delete() will know whether an object was actually deleted.
            //     return this.where(":id").equals(key).delete();
            // } else {
            //     // No one listens. Use standard IDB delete() method.
            //     return this._idbstore(READWRITE, function (resolve, reject, idbstore) {
            //         var req = idbstore.delete(key);
            //         req.onerror = eventRejectHandler(reject, ["deleting", key, "from", idbstore.name]);
            //         req.onsuccess = function (ev) {
            //             resolve(req.result);
            //         };
            //     });
            // }
            return $q(function(resolve){
                self.instance.transaction("rw", function(t){
                    t.executeSql(`DELETE FROM ${self.name} WHERE rowid = ${id}`, [], function(tx, result){
                        self.nRows -= result.rowsAffected;
                        resolve();
                    });
                }).catch(function(e){
                    console.log(e);
                });
            });
        }

        add(obj){
            var self = this;
            return $q(function(resolve){
                var keys = Object.keys(obj);
                var n = "?,".repeat(keys.length).slice(0,-1);
                var args = keys.map(key => obj[key]);

                self.instance.transaction("rw", function(t){
                    t.executeSql(`INSERT INTO ${self.name} (${keys}) VALUES (${n})`, args, function(tx, result){
                        self.nRows += result.rowsAffected;
                        resolve(result.insertId);
                    });
                });
            });
        }

        each(fn){
            return this.toArray().then(function(result){
                result.forEach(fn);
            });
        }

    }

    window.WriteableTable = WriteableTable;

    window.Websql=Websql;
    return Websql;

}])







/*

{
  "statement": [
    {
      "explain": false,
      "type": "statement",
      "name": {
        "type": "identifier",
        "variant": "table",
        "name": "bees"
      },
      "condition": [],
      "optimization": [],
      "definition": [
        {
          "type": "definition",
          "variant": "column",
          "name": "id",
          "definition": [
            {
              "name": null,
              "type": "constraint",
              "variant": "primary key",
              "conflict": "rollback",
              "direction": null,
              "modififer": null,
              "autoIncrement": true
            }
          ],
          "datatype": {
            "type": "datatype",
            "variant": "integer",
            "affinity": "integer",
            "args": []
          }
        },
        {
          "type": "definition",
          "variant": "column",
          "name": "name",
          "definition": [
            {
              "name": null,
              "type": "constraint",
              "variant": "not null",
              "conflict": null
            },
            {
              "name": null,
              "type": "constraint",
              "variant": "unique",
              "conflict": null
            }
          ],
          "datatype": {
            "type": "datatype",
            "variant": "varchar",
            "affinity": "text",
            "args": [
              {
                "type": "literal",
                "variant": "decimal",
                "value": "50"
              }
            ]
          }
        },
        {
          "type": "definition",
          "variant": "column",
          "name": "wings",
          "definition": [
            {
              "name": "has_enough_wings",
              "type": "constraint",
              "variant": "check",
              "expression": {
                "type": "expression",
                "format": "binary",
                "variant": "operation",
                "operation": ">=",
                "left": {
                  "type": "identifier",
                  "variant": "column",
                  "name": "wings"
                },
                "right": {
                  "type": "literal",
                  "variant": "decimal",
                  "value": "2"
                }
              }
            }
          ],
          "datatype": {
            "type": "datatype",
            "variant": "integer",
            "affinity": "integer",
            "args": []
          }
        },
        {
          "type": "definition",
          "variant": "column",
          "name": "legs",
          "definition": [
            {
              "name": "too_many_legs",
              "type": "constraint",
              "variant": "check",
              "expression": {
                "type": "expression",
                "format": "binary",
                "variant": "operation",
                "operation": "<=",
                "left": {
                  "type": "identifier",
                  "variant": "column",
                  "name": "legs"
                },
                "right": {
                  "type": "literal",
                  "variant": "decimal",
                  "value": "6"
                }
              }
            }
          ],
          "datatype": {
            "type": "datatype",
            "variant": "integer",
            "affinity": "integer",
            "args": []
          }
        }
      ],
      "temporary": false,
      "variant": "create",
      "format": "table"
    }
  ]
}
*/