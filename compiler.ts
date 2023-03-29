type LeftAngleBracket = { type: "leftAngleBracket"; re: RegExp };
type RightAngleBracket = { type: "rightAngleBracket"; re: RegExp };
type ForwardSlash = { type: "forwardSlash"; re: RegExp };
type DoubleQuote = { type: "doubleQuote"; re: RegExp };
type Equal = { type: "equal"; re: RegExp };
type Whitespace = { type: "whitespace"; re: RegExp };
type CarriageReturn = { type: "carriageReturn"; re: RegExp };
type Text = { type: "text"; re: RegExp };

const leftAngleBracket: LeftAngleBracket = {
  type: "leftAngleBracket",
  re: /^\</,
};

const carriageReturn: CarriageReturn = {
  type: "carriageReturn",
  re: /^\n/,
};

const whitespace: Whitespace = {
  type: "whitespace",
  re: /^\s/,
};

const rightAngleBracket: RightAngleBracket = {
  type: "rightAngleBracket",
  re: /^\>/,
};

const forwardSlash: ForwardSlash = {
  type: "forwardSlash",
  re: /^\//,
};

const doubleQuote: DoubleQuote = {
  type: "doubleQuote",
  re: /^"/,
};

const equal: Equal = {
  type: "equal",
  re: /^=/,
};

const text: Text = {
  type: "text",
  re: /^([A-Za-z0-9!]*)/,
};

const tokens = [
  carriageReturn,
  leftAngleBracket,
  rightAngleBracket,
  whitespace,
  forwardSlash,
  doubleQuote,
  equal,
  text,
] as const;

export type Match = {
  token: typeof tokens[number];
  char: string;
};

function match(template: string): Match {
  for (const token of tokens) {
    const res = token.re.exec(template);
    if (res?.[0]) {
      return {
        token,
        char: res[0],
      };
    }
  }

  throw Error(`Could not match for ${template}`);
}

export function tokenize(template: string): Match[] {
  const toks: Match[] = [];

  while (template) {
    const tok = match(template);
    template = template.slice(tok.char.length);
    toks.push(tok);
  }

  return toks;
}

export interface Node {
  tag: string;
  parent?: Node;
  children: Node[];
  attrs: Record<string, string>;
  depth: number;
  content?: string;
}

export class Parser {
  tokens: Match[];
  root: Node;
  currentParent?: Node;
  depth: number = 0;

  constructor(_tokens: Match[], _root: Node) {
    this.tokens = _tokens.filter((x) => x.token.type !== "carriageReturn");
    this.root = _root;
  }

  get html() {
    return this.tokens.map((x) => x.char).join("");
  }

  peekClosingTag() {
    return this.tokens[0].char === "<" && this.tokens[1].char === "/";
  }

  peekOpeningTag() {
    return this.tokens[0].char === "<" && this.tokens[1].char !== "/";
  }

  consumeWhitespace() {
    if (this.peek().token.type !== "whitespace") {
      return;
    }

    while (this.tokens[0].token.type === "whitespace") {
      this.consume();
    }
  }

  consume() {
    return this.tokens.shift();
  }

  consumeAttrs(): Record<string, string> {
    this.consumeWhitespace();

    let attrs: Record<string, string> = {};

    while (this.peek().char !== ">") {
      const k = this.consume()?.char; // key
      this.consume(); // =
      this.consume(); // opening "
      const v = this.consume()?.char; // val
      attrs[k!] = v!;
      this.consume(); // closing "
      this.consumeWhitespace();
    }
    return attrs;
  }

  peek() {
    return this.tokens[0];
  }

  parse(parent: Node): Node {
    if (!this.tokens.length) {
      return this.root;
    }

    this.consumeWhitespace();

    if (this.peek().token.type === "text") {
      // text node
      const node: Node = {
        tag: "TEXT",
        parent: this.currentParent ?? parent,
        depth: this.depth,
        children: [],
        attrs: {},
        content: this.consume()?.char,
      };

      node.parent?.children.push(node);
      return this.parse(node);
    }

    if (this.peekClosingTag()) {
      this.depth--;
      this.consume(); // <
      this.consume(); // /
      const tag = this.consume(); // div
      this.consume(); // >
      this.currentParent = this.currentParent?.parent;
      return this.parse(parent);
    }

    if (this.peekOpeningTag()) {
      this.depth++;
      this.consume(); // <
      const tag = this.consume()?.char!; // div
      const attrs = this.consumeAttrs();
      this.consume(); // >

      const node: Node = {
        tag,
        parent: this.currentParent ?? parent,
        attrs,
        depth: this.depth,
        children: [],
      };

      node.parent?.children.push(node);
      this.currentParent = node;
      return this.parse(node);
    }

    if (!this.tokens.length) {
      return this.root;
    }

    throw Error(this.html);
  }
}

function print(nodes: Node[]) {
  let str = "";
  function _print(nodes: Node[]) {
    for (const node of nodes) {
      str += "  ".repeat(node.depth) + node.tag;
      str += "\n";
      _print(node.children);
    }
  }
  _print(nodes);
  return str;
}
