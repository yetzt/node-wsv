#!/usr/bin/env node

var stream = require("stream");

var presets = {
	csv: { // comma separated values
		sep: ",",
		quote: "\"",
		escape: "\\",
		break: "\n",
		empty: "",
		buffers: true,
		objects: true,
		unbreak: true,
		untab: false,
		sanitize: false,
		formulaescape: false,
	},
	tsv: { // tab separated values
		sep: "\t",
		quote: "\"",
		escape: "\\",
		break: "\n",
		empty: "",
		buffers: true,
		objects: true,
		unbreak: true,
		untab: true,
		sanitize: false,
		formulaescape: false,
	},
	ssv: { // semicolon separated values (what excel does in some localizations)
		sep: 0x3b,
		quote: "\"",
		escape: "\\",
		break: "\n",
		empty: "",
		buffers: true,
		objects: true,
		unbreak: true,
		untab: false,
		sanitize: false,
		formulaescape: false,
	},
	asv: { // ascii separated values
		sep: 0x1f,
		quote: 0x2,
		startquote: 0x3,
		escape: 0x1b,
		break: 0x1e,
		empty: "",
		buffers: true,
		objects: true,
		unbreak: false,
		untab: false,
		sanitize: false,
		formulaescape: false,
	},
};

var wsv = module.exports = function(opts){
	if (!(this instanceof wsv)) return new wsv(opts);
	var self = this;
	self.header = null;
	self.opts = self.parseOpts(opts);
	
	self.stream = new stream.Transform({
		objectMode: true,
		transform: function(chunk, encoding, fn) {
			self.handle(chunk, fn);
		}
	});

	return self.stream;
};

// handle strings
wsv.prototype.stringify = function(field) {
	var self = this;

	field = Buffer.from(field);
	var collect = [];
		
	// check if nessecary
	var needquotes = field.includes(self.opts.sep);
		
	if (needquotes) collect.push((self.opts.startquote !== null) ? self.opts.startquote[0] : self.opts.quote[0]);

	for (var i = 0; i < field.length; i++) {

		// formula escape: prefix characters that might lead excel to interpret fields as formulae with 0x27 to prevent this
		if (i === 0 && self.opts.formulaescape && (field[i] === 0x22 || field[i] === 0x3d || field[i] === 0x2b || field[i] === 0x2d || field[i] === 0x40 || field[i] === 0x9 || field[i] === 0xd)) collect.push(0x27);

		// sanitize: remove non printable characters
		if (self.opts.sanitize && ((field[i] <= 0x1f) || (field[i] >= 0x7f && field[i] <= 0x9f))) continue;

		if (self.opts.untab && field[i] === 0x9) {
			collect.push(0x5c);
			collect.push(0x74);
			continue;
		}
		
		if (self.opts.unbreak) {
			if (field[i] === 0xa) {
				collect.push(0x5c);
				collect.push(0x6e);
				continue;
			}
			if (field[i] === 0xb) {
				collect.push(0x5c);
				collect.push(0x76);
				continue;
			}
			if (field[i] === 0xc) {
				collect.push(0x5c);
				collect.push(0x66);
				continue;
			}
			if (field[i] === 0xd) {
				collect.push(0x5c);
				collect.push(0x72);
				continue;
			}
		}
		
		if (field[i] === 0x5c && (self.opts.untab || self.opts.unbreak) && (!needquotes || self.opts.escape[0] !== 0x5c)) {
			collect.push(0x5c);
			collect.push(0x5c);
			continue;
		}
			
		if (needquotes) {
		
			if (field[i] === self.opts.quote[0]) {
				collect.push(self.opts.escape[0]);
			}

			if (field[i] === self.opts.escape[0]) {
				collect.push(self.opts.escape[0]);
			}

		}

		collect.push(field[i]);

	};
	
	if (needquotes) collect.push(self.opts.quote[0]);
		
	return Buffer.from(collect);
};

wsv.prototype.assemble = function(record) {
	var self = this;
	
	var line = [];
	
	record.forEach(function(field,idx){
				
		if (idx > 0) line.push(self.opts.sep);
		
		switch (typeof field) {
			case "number":
			case "boolean":
				return line.push(Buffer.from(field.toString()));
			break;
			case "string":
				// oh dear
				return line.push(self.stringify(field));
			break;
			case "object":
				if (!field) ;
				if (field instanceof Buffer) return line.push(Buffer.from("0x"+field.toString("hex")));
				if (field instanceof Object || field instanceof Array) return (self.opts.objects) ? line.push(self.stringify(JSON.stringify(field))) : line.push(Buffer.from(field.toString()))
			break;
		}
		return line.push(self.opts.empty); // everything we can't handle gets an empty entry
	});
	line.push(self.opts.break);
	
	self.stream.push(Buffer.concat(line))
	
	return this;
};

wsv.prototype.handle = function(data, done){
	var self = this;
	
	// ignore anything but objects
	if (typeof data !== "object") return done();

	if (data instanceof Array) {
		var finished = 0;
		data.forEach(function(record){
			self.handle(record, function(){
				if (++finished === data.length) done();
			});
		});
	} else if (data instanceof Object && !!data && data.constructor === Object) {

		// objtain header from object keys
		if (!self.header) {
			self.header = (!!self.opts.header) ? self.opts.header : Object.keys(data);
			self.assemble(self.header);
		}
		
		self.assemble(self.header.map(function(k){ return data[k]; }));
		
	};
	return done();
};

wsv.prototype.parseOpts = function(opts){
	var self = this;
	
	// opts is a preset, use preset
	if (typeof opts === "string" && !!presets.hasOwnProperty(opts)) opts = presets[opts];

	// if opts is not an object, assume opts is the separator
	if (typeof opts !== "object" || !(opts instanceof Object) || opts.constructor !== Object) opts = { sep: opts };
	
	// check for preset 
	if (opts.hasOwnProperty("preset") && presets.hasOwnProperty(opts.preset)) Object.keys(presets[opts.preset]).forEach(function(k){ 
		if (!opts.hasOwnProperty(k)) opts[k] = presets[opts.preset][k];
	});
	
	return {
		sep: self.parseOpt(opts.sep, Buffer.from(",")),
		quote: self.parseOpt(opts.quote, Buffer.from("\"")),
		startquote: self.parseOpt(opts.startquote, null),
		escape: self.parseOpt(opts.escape, Buffer.from("\\")),
		break: self.parseOpt(opts.break, Buffer.from("\n")),
		empty: self.parseOpt(opts.empty, Buffer.from("")),
		header: (opts.hasOwnProperty("header") && (opts.header instanceof Array)) ? opts.header : null,
		buffers: (opts.hasOwnProperty("buffers")) ? !!opts.buffers : true,
		objects: (opts.hasOwnProperty("objects")) ? !!opts.unbreak : true,
		unbreak: (opts.hasOwnProperty("unbreak")) ? !!opts.unbreak : true,
		untab: (opts.hasOwnProperty("untab")) ? !!opts.untab : true,
		sanitize: (opts.hasOwnProperty("sanitize")) ? !!opts.sanitize : false,
		formulaescape: (opts.hasOwnProperty("formulaescape")) ? !!opts.formulaescape : false,
	};
};

wsv.prototype.parseOpt = function(v,d){
	var self = this;
	if (!v) return d;
	switch (typeof v) {
		case "number": return Buffer.from([ v ]); break;
		case "string": return Buffer.from( v ); break;
		case "object":
			if (v instanceof Array) return Buffer.from( v );
			if (v instanceof Array) return Buffer.from( v );
		break;
	}
	return d;
};
