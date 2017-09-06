
const uglify = require('uglify-js');
const ScriptCompiler = require('./compiler.js');
const Dependencies = require('vengeance-dependencies');

/*** CLASS *******************************************************************/

class VengeanceScripts {
    constructor(dest_path, relative_src_path){
        this.modules = {};
        this.filepath = dest_path;
        this.srcpath = (relative_src_path === undefined ? '../../pug/modules' : relative_src_path);
    }
    
    addModules(modules){
        for(var key in modules){
            if(!(key in this.modules)){
                this.modules[key] = modules[key];
            }
        }
    }
    
    compile(debug){
        var src = '';
        var filepath, module;
        var found = false;
        
        var deps = new Dependencies('script', this.modules);
        var modules = deps.getOrder();
        var compiler = new ScriptCompiler("scripts.js", debug);
        
        for(var i = 0; i < modules.length; i++){
            module = this.modules[modules[i]];
            if(module.script && module.script.src.trim()){
                console.log(module.namespace, module.file);
                compiler.add(module.namespace, module.file, module.script, module.name);
                found = true;
            }
        }
        
        if(!found){
            return;
        }
        
        src = compiler.run();
        
        filepath = this.filepath;
        i = filepath.lastIndexOf('/');
        
        if(~i){
            filepath = filepath.substr(i + 1);
        }
        
        var options = {
            sourceMap: {
                content: src.map,
                filename: "scripts.js.map",
                url: "/www/maps/scripts.js.map",
                root: "../../pug/modules/"
            }
        };
        
        if(debug){
            return { 
                js: Buffer.from(
                    src.js //+ '\n\n//# sourceMappingURL=/www/maps/scripts.js.map'
                ), 
                map: Buffer.from(src.map)
            };
        }
        
        src = uglify.minify(src.js, options);
        
        if(src.error){
            throw src.error;
        }
        
        return { js: Buffer.from(src.code), map: Buffer.from(src.map) };
    }
}
module.exports = VengeanceScripts;