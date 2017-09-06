
const SourceMapGenerator = require('source-map').SourceMapGenerator;

const LINE_SPLIT = /(?:\r\n|\r|\n)/;

/*** CLASS *******************************************************************/

class ScriptCompiler {
    constructor(filename, debug){
        this.filename = filename;
        this.debug = debug;
        this.map = new SourceMapGenerator({ 
            file: filename + '.map',
            sourceRoot: "../../pug/modules/"
        });
        this.js = '(function(){"use strict";var modules = {\n';
        this.first_module = true;
        this.line = 2; // lines are 1-based
        this.col = 0;  // cols are 0-based
        this.modules = {};
        this.deps = [''];
        this.names = [''];
    }

    add(namespace, module, script, name){
        var filepath = namespace + '/' + module + '.md.js';
        var lines = script.src.split(LINE_SPLIT);
        var key = JSON.stringify(namespace + '/' + module) + ':';
        
        if(this.first_module){
            this.first_module = false;
        } else {
            this.js += ',\n';
            this.line++;
            this.col = 0;
        }
        
        var deps = namespace + '/' + module;
        var dep, post;
        var args = '';
        
        if(script.deps){
            deps = [deps];
            post = [];
            for(var dep_name in script.deps){
                dep = script.deps[dep_name];
                if(dep.as){
                    args += ', ';
                    args += dep.as;
                    deps.push(this.modules[dep_name] || 0);
                } else {
                    post.push(this.modules[dep_name] || 0);
                }
            }
            deps = deps.concat(post);
        }
        
        this.js += key + 'function(require, module, exports' + args + '){';
        
        var off = script.prepend.split(LINE_SPLIT).length;
        
        for(var i = 0; i < lines.length; i++){
            this.js += '\n' + lines[i];
            this.map.addMapping({
                generated: {
                    line: ++this.line,
                    column: 0
                },
                original: {
                    line: i + off,
                    column: 0
                },
                source: filepath
            });
        }
        
        this.js += '\n}\n';
        this.line += 2;
        this.col = 0;
        
        // add the deps and mark this module's position
        this.modules[namespace + '/' + module] = this.deps.push(deps) - 1;
        this.names.push(name || '');
    }

    buildDeps(modules, deps, names){
        var args, dep;
        
        function requireFn(d){
            var available = {};
            dep = d;
            
            if(Array.isArray(d)){
                console.log(d);
                for(var j = 1; j < d.length; j++){
                    args.push(available[names[d[j]]] = deps[d[j]]);
                }
                dep = d[0];
            }
            
            var n = dep;
            return function require(name){
                console.log('Require called:', n, name);
                return available[name];
            };
        }
        
        for(var i = 1; i < deps.length; i++){
            args = [0, {}, {}];
            args[1].exports = args[2];
            args[0] = requireFn(deps[i]); // fills in the other args as well!
            modules[dep].apply(null, args);
            modules[dep] = deps[i] = args[1].exports;
        }
    }

    buildModules(modules){
        for(var i in modules){
            modules[i] = modules[i].call(null);
        }
    }

    functionSrc(fn, spaces){
        fn = fn.toString().split('){').slice(1).join('){');
        fn = fn.substr(0, fn.lastIndexOf('}'));
        return fn
            // normalize line returns
            .replace(/(\r\n|\r|\n)/g, '\n');
    }

    run(){
        var has_deps = false;
        
        for(var i = this.deps.length; i--; ){
            if(Array.isArray(this.deps[i])){
                has_deps = true;
                break;
            }
        }
        
        var src = this.js + '\n};';
        
        this.map.addMapping({
            generated: {
                line: ++this.line,
                column: 0
            }
        });
        
        if(has_deps){
            src += '\nvar deps = ' + JSON.stringify(this.deps) + ';';
            src += '\nvar names = ' + JSON.stringify(this.names) + ';';
            src += '\n' + this.functionSrc(this.buildDeps, '  ');
        } else {
            src += '\n' + this.functionSrc(this.buildModules, '  ');
        }
        
        if(this.debug){
            src = 'var modules = ' + src + '\nreturn modules;';
        }
        src += '\n})();';
        
        return { js:src, map: this.map.toString() };
    }
}

module.exports = ScriptCompiler;