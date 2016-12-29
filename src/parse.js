/**
 *  关于 Angular expression parser
 *
 *  step 1: from string to tokens : Lexer
 *  step 2: from tokens to AST(Abstract Syntax Tree) : AST Builder
 *  step 3: from AST to Expression Function: AST Compiler
 * */

/**
 * 数组 Tokens -> AST
 * '[{"text":"["},{"text":"1","value":1},{"text":","},{"text":"two","value":"two"},{"text":","},{"text":"["},{"text":"3","value":3},{"text":"]"},{"text":","},{"text":"true","identifier":true},{"text":"]"}]'
 * '{"type":"Program","body":{"type":"ArrayExpression","elements":[{"type":"Literal","value":1},{"type":"Literal","value":"two"},{"type":"ArrayExpression","elements":[{"type":"Literal","value":3}]},{"type":"Literal","value":true}]}}'
 *
 * 对象 Tokens -> AST
 * '[{"text":"{"},{"text":"a","identifier":true},{"text":":"},{"text":"1","value":1},{"text":","},{"text":"b","identifier":true},{"text":":"},{"text":"["},{"text":"2","value":2},{"text":","},{"text":"3","value":3},{"text":"]"},{"text":","},{"text":"c","identifier":true},{"text":":"},{"text":"{"},{"text":"d","identifier":true},{"text":":"},{"text":"4","value":4},{"text":"}"},{"text":"}"}]'
 * '{"type":"Program","body":{"type":"ObjectExpression","properties":[{"type":"Property","key":{"type":"Identifier","name":"a"},"value":{"type":"Literal","value":1}},{"type":"Property","key":{"type":"Identifier","name":"b"},"value":{"type":"ArrayExpression","elements":[{"type":"Literal","value":2},{"type":"Literal","value":3}]}},{"type":"Property","key":{"type":"Identifier","name":"c"},"value":{"type":"ObjectExpression","properties":[{"type":"Property","key":{"type":"Identifier","name":"d"},"value":{"type":"Literal","value":4}}]}}]}}'
 * */

import _ from 'lodash';

var ESCAPES = {'n': '\n', 'f': '\f', 'r': '\r', 't': '\t',
	'v': '\v', '\'': '\'', '"': '"'};

// 实现第一步中的 Lexer (词法分析程序)
class Lexer {
	lex(text) {
		// Tokenization will be done here
		this.text = text;
		this.index = 0;
		this.ch = undefined;
		this.tokens = [];
		while (this.index < this.text.length) {
			this.ch = this.text.charAt(this.index);
			if (this.isNumber(this.ch) ||
				(this.is('.') && this.isNumber(this.peek()))) {
				this.readNumber();
			} else if (this.is('\'"')) {
				this.readString(this.ch);
			} else if (this.is('[],{}:.')) {
				this.tokens.push({
					text: this.ch
				});
				this.index++;
			} else if (this.isIdent(this.ch)) {
				this.readIdent();
			} else if (this.isWhitespace(this.ch)) {
				this.index++;
			} else {
				throw new Error('Unexpected next character: ' + this.ch);
			}
		}

		return this.tokens;
	}

	isNumber(ch) {
		return ch >= '0' && ch <= '9';
	}

	readNumber() {
		var number = '';
		while (this.index < this.text.length) {
			var ch = this.text.charAt(this.index).toLowerCase();
			if (ch === '.' || this.isNumber(ch)) {
				number += ch;
			} else {
				var nextCh = this.peek();
				var prevCh = number.charAt(number.length - 1);
				// 下面处理科学计数的情况
				if (ch === 'e' && this.isExpOperator(nextCh)) {
					number += ch;
				} else if (this.isExpOperator(ch) && prevCh === 'e' &&
					nextCh && this.isNumber(nextCh)) {
					number += ch;
				} else if (this.isExpOperator(ch) && prevCh === 'e' &&
					(!nextCh || !this.isNumber(nextCh))) {
					throw new Error('Invalid exponent');
				} else {
					break;
				}
			}
			this.index++;
		}

		this.tokens.push({
			text: number,
			value: Number(number)
		});
	}

	// 获取当前字符的下一个字符, 如果没有, 返回 false
	peek() {
		return this.index < this.text.length - 1 ? this.text.charAt(this.index + 1) : false;
	}

	isExpOperator(ch) {
		return ch === '-' || ch === '+' || this.isNumber(ch);
	}

	readString(quote) {
		// 跳过开始 ' 或 "
		this.index++;
		var string = '';
		var escape = false;

		while (this.index < this.text.length) {
			var ch = this.text.charAt(this.index);
			// 如果使用转义
			if (escape) {
				// 处理 Unicode
				if (ch === 'u') {
					var hex = this.text.substring(this.index + 1, this.index + 5);
					// 判断 Unicode 是否合法
					if (!hex.match(/[\da-f]{4}/i)) {
						throw new Error('Invalid unicode escape');
					}
					this.index += 4;
					string += String.fromCharCode(parseInt(hex, 16));
				} else {
					var replacement = ESCAPES[ch];
					if (replacement) {
						string += replacement;
					} else {
						string += ch;
					}
				}
				escape = false;
				// 判断结束符 是否 以开始符 相同 避免一个单引号, 一个双引号
			} else if (ch === quote) {
				// 跳过结束的 ' 或 "
				this.index++;
				this.tokens.push({
					text: string,
					value: string
				});
				return;
			} else if (ch === '\\') { //  \\ 是一个字符
				escape = true;
			} else {
				string += ch;
			}
			this.index++;
		}
		throw new Error('Unmatched quote');
	}

	isIdent(ch) {
		return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
	}

	readIdent() {
		var text = '';
		while (this.index < this.text.length) {
			var ch = this.text.charAt(this.index);
			if (this.isIdent(ch) || this.isNumber(ch)) {
				text += ch;
			} else {
				break;
			}
			this.index++;
		}
		var token = {
			text: text,
			identifier: true
		};
		this.tokens.push(token);
	}

	isWhitespace(ch) {
		return ch === ' ' || ch === '\r' || ch === '\t' || ch === '\n' || ch === '\v' || ch === '\u00A0'; // '\u00A0' 是空字符
	}

	is(chs) {
		return chs.indexOf(this.ch) >= 0;
	}
}

// 实现第二步中的 AST builder (抽象语法树构建程序)
class AST {

	constants = {
		'null': {type: AST.Literal, value: null},
		'true': {type: AST.Literal, value: true},
		'false': {type: AST.Literal, value: false},
		'this': {type: AST.ThisExpression},
		'$locals': {type: AST.LocalsExpression}
	}

	constructor(lexer) {
		this.lexer = lexer;
	}

	ast(text) {
		this.tokens = this.lexer.lex(text);
		// console.log(JSON.stringify(this.tokens));
		// AST building will be done here
		return this.program();
	}

	program() {
		return {type: AST.Program, body: this.primary()};
	}

	constant() {
		return {type: AST.Literal, value: this.consume().value};
	}

	primary() {
		let primary;
		if (this.expect('[')) {
			primary = this.arrayDeclaration();
		} else if (this.expect('{')) {
			primary = this.object();
		} else if (this.constants.hasOwnProperty(this.tokens[0].text)) {
			primary = this.constants[this.consume().text];
		} else if (this.peek().identifier) {
			primary = this.identifier();
		} else {
			primary = this.constant();
		}

		while (this.expect('.')) {
			primary = {
				type: AST.MemberExpression,
				object: primary,
				property: this.identifier()
			};
		}
		return primary;
	}

	peek(e) {
		if (this.tokens.length > 0) {
			var text = this.tokens[0].text;
			if (text === e || !e) {
				return this.tokens[0];
			}
		}
	}

	arrayDeclaration() {
		var elements = [];
		if (!this.peek(']')) {
			do {
				if (this.peek(']')) {
					break;
				}
				elements.push(this.primary());
			} while (this.expect(','));
		}
		this.consume(']');
		return {type: AST.ArrayExpression, elements: elements};
	}

	// 与 expect 作用一样, 抛出异常, 例如 数组如果不以 [ 结尾的话, 抛出异常
	consume(e) {
		var token = this.expect(e);
		if (!token) {
			throw new Error('Unexpected. Expecting: ' + e);
		}
		return token;
	}

	// 删除特定的 token, 例如数组需要删除 [ , ]
	expect(e) {
		var token = this.peek(e);
		if (token) {
			return this.tokens.shift();
		}
	}

	object() {
		var properties = [];
		if (!this.peek('}')) {
			do {
				var property = {type: AST.Property};
				if (this.peek().identifier) {
					property.key = this.identifier();
				} else {
					property.key = this.constant();
				}
				this.consume(':');
				property.value = this.primary();
				properties.push(property);
			} while (this.expect(','));
		}
		this.consume('}');
		return {type: AST.ObjectExpression, properties: properties};
	};

	identifier() {
		return {type: AST.Identifier, name: this.consume().text};
	};
}

AST.Program = 'Program';
AST.Literal = 'Literal';
AST.ArrayExpression = 'ArrayExpression';
AST.ObjectExpression = 'ObjectExpression';
AST.Property = 'Property';
AST.Identifier = 'Identifier';
AST.ThisExpression = 'ThisExpression';
AST.MemberExpression = 'MemberExpression';
AST.LocalsExpression = 'LocalsExpression';

// 实现第三步中的 AST Compiler (抽象语法树编译程序)
class ASTCompiler {

	stringEscapeRegex = /[^ a-zA-Z0-9]/g

	constructor(astBuilder) {
		this.astBuilder = astBuilder;
	}

	compile(text) {
		// AST compilation will be done here
		var ast = this.astBuilder.ast(text);
		// console.log(JSON.stringify(ast));
		this.state = {body: [], nextId: 0, vars: []};
		this.recurse(ast);

		return new Function('s', 'l',
			(this.state.vars.length ? 'var ' + this.state.vars.join(',') + ';' : '') + this.state.body.join(''));
	}

	recurse(ast) {
		var intoId;
		switch (ast.type) {
			case AST.Program:
				this.state.body.push('return ', this.recurse(ast.body), ';');
				break;
			case AST.Literal:
				return this.escape(ast.value);
			case AST.ArrayExpression:
				var elements = _.map(ast.elements, _.bind(function (element) {
					return this.recurse(element);
				}, this));
				return '[' + elements.join(',') + ']';
			case AST.ObjectExpression:
				var properties = _.map(ast.properties, _.bind(function (property) {
					var key = property.key.type === AST.Identifier ? property.key.name : this.escape(property.key.value);
					var value = this.recurse(property.value);
					return key + ':' + value;
				}, this));
				return '{' + properties.join(',') + '}';
			case AST.Identifier:
				intoId = this.nextId();
				this.if_(this.getHasOwnProperty('l', ast.name),
					this.assign(intoId, this.nonComputedMember('l', ast.name)));
				this.if_(this.not(this.getHasOwnProperty('l', ast.name)) + ' && s',
					this.assign(intoId, this.nonComputedMember('s', ast.name)));
				return intoId;
			case AST.ThisExpression:
				return 's';
			case AST.MemberExpression:
				intoId = this.nextId();
				var left = this.recurse(ast.object);
				this.if_(left,
					this.assign(intoId, this.nonComputedMember(left, ast.property.name)));
				return intoId;
			case AST.LocalsExpression:
				return 'l';
		}
	}

	// 如果是 string 加上单引号 并转义特殊字符, 例如汉字等
	escape(value) {
		if (_.isString(value)) {
			return '\'' +
				value.replace(this.stringEscapeRegex, this.stringEscapeFn) + // 除过空格数字和字母
				'\'';
		} else if (_.isNull(value)) {
			return 'null';
		} else {
			return value;
		}
	}

	// 转义其他字符
	stringEscapeFn(c) {
		return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
	}

	nonComputedMember(left, right) {
		return '(' + left + ').' + right;
	}

	if_(test, consequent) {
		this.state.body.push('if(', test, '){', consequent, '}');
	}

	assign(id, value) {
		return id + '=' + value + ';';
	}

	nextId() {
		var id = 'v' + (this.state.nextId++);
		this.state.vars.push(id);
		return id;
	}

	not(e) {
		return '!(' + e + ')';
	}

	getHasOwnProperty(object, property) {
		return object + '&&(' + this.escape(property) + ' in ' + object + ')';
	}
}

// 将第二和第三步 放在一起
class Parser {
	constructor(lexer) {
		this.lexer = lexer;
		this.ast = new AST(this.lexer);
		this.astCompiler = new ASTCompiler(this.ast);
	}

	parse(text) {
		return this.astCompiler.compile(text);
	}
}

// 对外公开的 parse 函数
function parse(expr) {
	var lexer = new Lexer();
	var parser = new Parser(lexer);
	return parser.parse(expr);
}

export default parse;
