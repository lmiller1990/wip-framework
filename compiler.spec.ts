import { describe, it, run } from "./runner.js";
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

    assert.equal(ast.children.length, 1)
    assert.equal(ast.children[0].tag, "div");
    assert.equal(ast.children[0].children[0].tag, "TEXT");
    assert.equal(ast.children[0].children[0].content, "ok");
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

    assert.equal(ast.children.length, 1);
    const div = ast.children[0];
    assert.equal(div.attrs.id, "main");
    assert.equal(div.attrs.class, "foo");
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

    assert.equal(ast.children.length, 1);
    assert.equal(ast.children[0].tag, "div");

    // div
    const div = ast.children[0];
    assert.equal(div.children.length, 2);
    assert.equal(div.children[0].tag, "span");
    assert.equal(div.children[1].tag, "p");

    // span
    const span = ast.children[0].children[0];
    assert.equal(span.children.length, 1);
    assert.equal(span.children[0].tag, "o");
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

    assert.equal(body.children.length, 2);
    assert.equal(body.children[0].tag, "h1");
    assert.equal(body.children[1].tag, "div");

    const div = body.children[1];
    assert.equal(div.attrs.id, "main");
    assert.equal(div.attrs.class, "test");

    const p = root.children[0].children[0].children[1].children[0];
    assert.equal(p.tag, "p");
    assert.equal(p.children.length, 3);
    assert.equal(p.children[0].tag, "TEXT"); // Hello
    assert.equal(p.children[1].tag, "em"); // <em>
    assert.equal(p.children[2].tag, "TEXT"); // !

    const em = p.children[1];
    assert.equal(em.children.length, 1);
    assert.equal(em.children[0].tag, "TEXT");
    assert.equal(em.children[0].content, "world");
  });
});

run();