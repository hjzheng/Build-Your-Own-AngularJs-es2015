/**
 *  关于 Angular expression parser
 *
 *  step 1: from string to tokens : Lexer
 *  step 2: from tokens to AST(Abstract Syntax Tree) : AST Builder
 *  step 3: from AST to Expression Function: AST Compiler
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
				(this.ch === '.' && this.isNumber(this.peek()))) {
				this.readNumber();
			} else if (this.ch === '\'' || this.ch === '"') {
				this.readString(this.ch);
			} else if (this.isIdent(this.ch)) {
				this.readIdent();
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
		var token = {text: text};
		this.tokens.push(token);
	}
}

// 实现第二步中的 AST builder (抽象语法树构建程序)
class AST {

	constants = {
		'null': {type: AST.Literal, value: null},
		'true': {type: AST.Literal, value: true},
		'false': {type: AST.Literal, value: false}
	}

	constructor(lexer) {
		this.lexer = lexer;
	}

	ast(text) {
		this.tokens = this.lexer.lex(text);
		// AST building will be done here
		return this.program();
	}

	program() {
		return {type: AST.Program, body: this.primary()};
	}

	constant() {
		return {type: AST.Literal, value: this.tokens[0].value};
	}

	primary() {
		if (this.constants.hasOwnProperty(this.tokens[0].text)) {
			return this.constants[this.tokens[0].text];
		} else {
			return this.constant();
		}
	}
}

AST.Program = 'Program';
AST.Literal = 'Literal';

// 实现第三步中的 AST Compiler (抽象语法树编译程序)
class ASTCompiler {

	stringEscapeRegex = /[^ a-zA-Z0-9]/g

	constructor(astBuilder) {
		this.astBuilder = astBuilder;
	}

	compile(text) {
		// AST compilation will be done here
		var ast = this.astBuilder.ast(text);
		this.state = {body: []};
		this.recurse(ast);

		return new Function(this.state.body.join(''));
	}

	recurse(ast) {
		switch (ast.type) {
			case AST.Program:
				this.state.body.push('return ', this.recurse(ast.body), ';');
				break;
			case AST.Literal:
				return this.escape(ast.value);
		}
	}

	// 如果是 string 加上单引号
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
	};
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
