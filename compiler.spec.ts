import { describe, it, expect, run } from "./runner.js";
import { tokenize, Parser, Node } from "./compiler.js";
import assert from "node:assert";

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

  it("works for full html document", () => {
    const tokens = tokenize(`
    <html>
        <body>
            <h1>Title</h1>
            <div id="main" class="test">
                <p>Hello <em>world</em>!</p>
            </div>
        </body>
    </html>`);
  });
});

describe("parser", () => {
  it("handles text nodes", () => {
    const html = `<div>ok</div>`;
    const tokens = tokenize(html);
    const root = {
      tag: "root",
      children: [],
      depth: 0,
      attrs: {},
    };

    const ast = new Parser(tokens, root).parse(root);

    expect(ast.children.length).toBe(1);
    expect(ast.children[0].tag).toBe("div");
    expect(ast.children[0].children[0].tag).toBe("TEXT");
    expect(ast.children[0].children[0].content).toBe("ok");
  });

  it("handles attrs", () => {
    const html = `<div id="main" class="foo"></div>`;
    const tokens = tokenize(html);
    const root = {
      tag: "root",
      children: [],
      depth: 0,
      attrs: {},
    };

    const ast = new Parser(tokens, root).parse(root);

    expect(ast.children.length).toBe(1);
    const div = ast.children[0];
    expect(div.attrs.id).toBe("main");
    expect(div.attrs.class).toBe("foo");
  });

  it("works with several levels of nesting", () => {
    const html = `<div><span><o></o></span><p></p></div>`;
    const tokens = tokenize(html);
    const root: Node = {
      attrs: {},
      tag: "root",
      children: [],
      depth: 0,
    };

    const ast = new Parser(tokens, root).parse(root);

    expect(ast.children.length).toBe(1);
    expect(ast.children[0].tag).toBe("div");

    // div
    const div = ast.children[0];
    expect(div.children.length).toBe(2);
    expect(div.children[0].tag).toBe("span");
    expect(div.children[1].tag).toBe("p");

    // span
    const span = ast.children[0].children[0];
    expect(span.children.length).toBe(1);
    expect(span.children[0].tag).toBe("o");
  });

  it("works on a more complex", () => {
    const tokens = tokenize(`
      <html>
          <body>
              <h1>Title</h1>
              <div id="main" class="test">
                  <p>Hello <em>world</em>!</p>
              </div>
          </body>
      </html>`);

    const root: Node = {
      attrs: {},
      tag: "root",
      children: [],
      depth: 0,
    };

    const ast = new Parser(tokens, root).parse(root);
    const body = ast.children[0].children[0];

    expect(body.children.length).toBe(2);
    expect(body.children[0].tag).toBe("h1");
    expect(body.children[1].tag).toBe("div");

    const div = body.children[1];
    expect(div.attrs.id).toBe("main");
    expect(div.attrs.class).toBe("test");

    const p = root.children[0].children[0].children[1].children[0];
    expect(p.tag).toBe("p");
    expect(p.children.length).toBe(3);
    expect(p.children[0].tag).toBe("TEXT"); // Hello
    expect(p.children[1].tag).toBe("em"); // <em>
    expect(p.children[2].tag).toBe("TEXT"); // !

    const em = p.children[1];
    expect(em.children.length).toBe(1);
    expect(em.children[0].tag).toBe("TEXT");
    expect(em.children[0].content).toBe("world");
  });
});

run();