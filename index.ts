function t(template: TemplateStringsArray, ...values: any[]) {
  return () => {};
}

type Component<P extends {}> = (props?: P) => string;

type Val = "double" | "triple";

const double: Component<{ count: number }> = (props) => {
  const double = () => {
    console.log("double");
    // emit.increase('double')
  };

  return `
    <div>Number is {props.count}</div>
    <button @click="double()">Double</button>
  `;
};

type LeftAngleBracket = { type: "leftAngleBracket"; re: RegExp };
type RightAngleBracket = { type: "rightAngleBracket"; re: RegExp };
type ForwardSlash = { type: "forwardSlash"; re: RegExp };
type DoubleQuote = { type: "doubleQuote"; re: RegExp };
type Equal = { type: "equal"; re: RegExp };
type Whitespace = { type: "whitespace"; re: RegExp };
type Text = { type: "text"; re: RegExp };

const leftAngleBracket: LeftAngleBracket = {
  type: "leftAngleBracket",
  re: /^\</,
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
  re: /^([A-Za-z]*)/,
};

// const tokens = ["<", ">", "/", `"`, " ", "="] as const;
const tokens = [
  leftAngleBracket,
  rightAngleBracket,
  whitespace,
  forwardSlash,
  doubleQuote,
  equal,
  text,
] as const;

// "<", ">", "/", "@", '"', "=", "{", "}", "(", ")"];

const eg = `
<html>
    <body>
        <h1>Title</h1>
        <div id="main" class="test">
            <p>Hello <em>world</em>!</p>
        </div>
    </body>
</html>
`;

import { describe, it, expect, run } from "./runner.js";
import assert from "node:assert";

type Match = {
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

function tokenize(template: string): Match[] {
  const toks: Match[] = [];

  while (template) {
    const tok = match(template);
    template = template.slice(tok.char.length);
    toks.push(tok);
  }

  return toks;
}

describe("tokenize", () => {
  it("simple case", () => {
    const tokens = tokenize(`<div>ok</div>`);
    assert.deepEqual(
      tokens.map((x) => x.char),
      ["<", "div", ">", "ok", "<", "/", "div", ">"]
    );
  });

  it("attributes", () => {
    const tokens = tokenize(`<div id="foo">ok</div>`);
    assert.deepEqual(
      tokens.map((x) => x.char),
      [
        "<",
        "div",
        " ",
        "id",
        "=",
        '"',
        "foo",
        '"',
        ">",
        "ok",
        "<",
        "/",
        "div",
        ">",
      ]
    );
  });

  it("nested", () => {
    const tokens = tokenize(`<div><span>ok</span></div>`);
    assert.deepEqual(
      tokens.map((x) => x.char),
      [
        "<",
        "div",
        ">",
        "<",
        "span",
        ">",
        "ok",
        "<",
        "/",
        "span",
        ">",
        "<",
        "/",
        "div",
        ">",
      ]
    );
  });
});

type Node = {
  tag: string;
  parent?: Node;
  attrs: Array<Record<string, string>>;
};

class Parser {
  stack: Match[];

  constructor(_tokens: Match[]) {
    this.stack = _tokens;
  }

  peek() {
    return this.stack[0];
  }

  consume() {
    return this.stack.shift();
  }

  consumeWhitespace() {
    while (this.peek().token.type === "whitespace") {
      this.consume();
    }
  }

  consumeAttrs() {
    const attrs: Array<{ key: string; value: string }> = [];
    while (this.peek().token.type !== "rightAngleBracket") {
      this.consumeWhitespace();
      const key = this.consume();
      this.consume(); // =
      this.consume(); // "
      const value = this.consume();
      this.consume(); // "

      if (!key || !value) {
        throw Error("Malformed HTML when parsing attrs");
      }

      attrs.push({ key: key!.char, value: value!.char });
    }
    return attrs;
  }

  consumeTag() {
    const c = this.consume();
    if (c?.token.type !== "text") {
      throw this.error("tag", c!);
    }
    return c.char;
  }

  error(expected: string, match: Match) {
    return new Error(
      `Malformed HTML. Expected "${expected}", got "${
        match?.char
      }". The HTML is:\n\n${JSON.stringify(this.stack, null, 4)}`
    );
  }

  peekTagOpenBracket() {
    const c = this.peek();
    return c?.token.type === "leftAngleBracket";
  }

  peekTextNode() {
    const c = this.peek();
    return c?.token.type === "text";
  }

  consumeTagOpeningBracket() {
    const c = this.consume();
    if (c?.token.type !== "leftAngleBracket") {
      throw this.error("<", c!);
    }
    return c;
  }

  peekTagClosingBracket() {
    return this.stack[0].token.type === "leftAngleBracket" && this.stack[1].token.type === 'forwardSlash'
  }

  consumeTagCloseingBracket() {
    const c = this.consume();
    if (c?.token.type !== "rightAngleBracket") {
      throw this.error(">", c!);
    }
    return c;
  }

  consumeText() {
    const c = this.consume();
    if (c?.token.type !== "text") {
      throw this.error("text", c!);
    }
    return c;
  }

  parseTextNode(parent: Node) {
    const t = this.consumeText();
    const n: Node = {
      tag: "text",
      attrs: [],
      parent,
    };
    console.log(`tag: ${n.tag}. parent: ${parent.tag}`)
    return n;
  }

  parseElement(parent: Node) {
    if (!this.peekTagOpenBracket()) {
      return this.parseTextNode(parent);
    }

    this.consumeTagOpeningBracket();

    const tag = this.consumeTag();
    const attrs = this.consumeAttrs();

    const node: Node = {
      tag,
      attrs,
      parent,
    };

    console.log(`tag: ${node.tag}. attrs ${JSON.stringify(attrs)}. parent: ${node.parent?.tag}`)

    this.consumeTagCloseingBracket();

    if (this.peekTextNode()) {
      return this.parseTextNode(node)
    }

    if (!this.peekTagOpenBracket()) {
      return node;
    }
    // console.log(JSON.stringify(node, null, 4));
    // console.log(this.stack)
    return this.parseChildren(node);
  }

  parseChildren(parent: Node): Node {
    const child = this.parseElement(parent);

    if (this.peekTagClosingBracket()) {
      this.consume() // <
      this.consume() // /
      this.consumeTag() // span
      this.consume() // >
      return child
    }


    if (this.peekTagOpenBracket()) {
      this.parseChildren(child);
    }
    return child;
  }

  parse() {
    const root: Node = {
      tag: "root",
      parent: undefined,
      attrs: [],
    };
    this.parseElement(root);
    console.log({root})
  }
}

describe("parser", () => {
  it("<div>ok</div>", () => {
    const tokens = tokenize(`<div id="foo" class="bar">ok</div>`);
    const ast = new Parser(tokens).parse();
    // console.log(JSON.stringify(ast, null, 4));
  });

  it.only("<div><span>ok</span></div>", () => {
    const tokens = tokenize(`<div id="foo"><span class="bar">ok</span></div>`);
    const ast = new Parser(tokens).parse();
    // console.log(JSON.stringify(ast, null, 4));
  });
});

run();
// function mount<P extends {}>(comp: Component<P>) {
//   if (!document) {
//     return
//   }
//   const el = document.createElement('div')
//   document.body.appendChild(el)
//   el.innerHTML = comp()
// }

// mount(double)
