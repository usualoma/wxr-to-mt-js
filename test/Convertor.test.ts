import csvParse from "csv-parse/lib/sync";
import fs from "fs";

import Converter, { PostType, Format } from "../src/Converter";

describe("create", () => {
  test("without error", () => {
    expect(new Converter()).toBeTruthy();
  });
});

describe("addDocument", () => {
  test("string", () => {
    const conv = new Converter();
    const xml = fs.readFileSync(__dirname + "/dataset/test.xml", "utf8");
    conv.addDocument(xml);
    expect(conv.postTypes()).toStrictEqual(["post", "page"]);
  });

  test("Document", () => {
    const conv = new Converter();
    const doc = (() => {
      const xml = fs.readFileSync(__dirname + "/dataset/test.xml", "utf8");
      const parser = new DOMParser();
      return parser.parseFromString(xml, "application/xml");
    })();
    conv.addDocument(doc);
    expect(conv.postTypes()).toStrictEqual(["post", "page"]);
  });

  test("multiple document", () => {
    const conv = new Converter();
    conv.addDocument(
      fs.readFileSync(__dirname + "/dataset/only-post.xml", "utf8")
    );
    conv.addDocument(
      fs.readFileSync(__dirname + "/dataset/only-page.xml", "utf8")
    );
    expect(conv.postTypes()).toStrictEqual(["post", "page"]);
  });
});

describe("postTypes", () => {
  test("without doc", () => {
    const conv = new Converter();
    expect(conv.postTypes()).toStrictEqual([]);
  });

  test("post, page", () => {
    const conv = new Converter();
    const xml = fs.readFileSync(__dirname + "/dataset/test.xml", "utf8");
    conv.addDocument(xml);
    expect(conv.postTypes()).toStrictEqual(["post", "page"]);
  });

  test("only post", () => {
    const conv = new Converter();
    const xml = fs.readFileSync(__dirname + "/dataset/only-post.xml", "utf8");
    conv.addDocument(xml);
    expect(conv.postTypes()).toStrictEqual(["post"]);
  });

  test("only page", () => {
    const conv = new Converter();
    const xml = fs.readFileSync(__dirname + "/dataset/only-page.xml", "utf8");
    conv.addDocument(xml);
    expect(conv.postTypes()).toStrictEqual(["page"]);
  });

  test("custom post type", () => {
    const conv = new Converter();
    const xml = fs.readFileSync(__dirname + "/dataset/news.xml", "utf8");
    conv.addDocument(xml);
    expect(conv.postTypes()).toStrictEqual(["post", "page", "news"]);
  });
});

describe("customFields", () => {
  test("without doc", () => {
    const conv = new Converter();
    expect(conv.customFields()).toStrictEqual([]);
  });

  test("some fields", () => {
    const conv = new Converter();
    const xml = fs.readFileSync(__dirname + "/dataset/test.xml", "utf8");
    conv.addDocument(xml);
    expect(conv.customFields()).toStrictEqual(["field1", "field2"]);
  });

  test("without fields", () => {
    const conv = new Converter();
    const xml = fs.readFileSync(
      __dirname + "/dataset/without-field.xml",
      "utf8"
    );
    conv.addDocument(xml);
    expect(conv.customFields()).toStrictEqual([]);
  });
});

describe("export", () => {
  test("export all", async () => {
    const conv = new Converter();
    conv.addDocument(fs.readFileSync(__dirname + "/dataset/news.xml", "utf8"));

    const zip = await conv.export({
      postTypeMap: {
        post: "post",
        page: "page",
        news: "post",
      },
      customFieldMap: {
        field1: "mt_net_field1",
        field2: "mt_net_field2",
      },
      convertBreaks: "__default__",
      dirname: "test",
    });

    expect(zip.file("test/categories.csv")).toBeTruthy();
    expect(zip.file("test/posts.csv")).toBeTruthy();
    expect(zip.file("test/pages.csv")).toBeTruthy();

    const posts = await zip.file("test/posts.csv").async("string");
    const records = csvParse(posts, {
      columns: true,
      skip_empty_lines: true,
    });
    expect(records[0]).toStrictEqual({
      basename: "hello-world",
      body: `<!-- wp:paragraph -->
<p>Welcome to WordPress. This is your first post. Edit or delete it, then start writing!</p>
<!-- /wp:paragraph -->`,
      category: "",
      cf_mt_net_field1: "",
      cf_mt_net_field2: "",
      "convert breaks": "richtext", // this content edited by gutenberg
      date: "2019-06-01 20:20:11",
      "extended body": "",
      status: "Publish",
      title: "Hello world!",
      type: "Post",
    });
    expect(records[1]).toStrictEqual({
      basename: "",
      body: "",
      "extended body": "",
      category: "cat1",
      cf_mt_net_field1: "",
      cf_mt_net_field2: "",
      "convert breaks": "__default__",
      date: "2019-06-01 20:22:10",
      status: "Draft",
      title: "post with category",
      type: "Post",
    });
    expect(records[2]).toStrictEqual({
      basename: "a-news-entry",
      body: "",
      category: "",
      cf_mt_net_field1: "",
      cf_mt_net_field2: "",
      "convert breaks": "__default__",
      date: "2019-06-01 20:28:54",
      "extended body": "",
      status: "Publish",
      title: "A news entry",
      type: "Post",
    });
  });

  test("only news", async () => {
    const conv = new Converter();
    conv.addDocument(fs.readFileSync(__dirname + "/dataset/news.xml", "utf8"));

    const zip = await conv.export({
      postTypeMap: {
        post: "",
        page: "",
        news: "page",
      },
      customFieldMap: {
        field1: "mt_net_field1",
        field2: "mt_net_field2",
      },
      convertBreaks: "__default__",
      dirname: "test",
    });

    expect(zip.file("test/categories.csv")).toBeFalsy();
    expect(zip.file("test/posts.csv")).toBeFalsy();
    expect(zip.file("test/pages.csv")).toBeTruthy();

    const pages = await zip.file("test/pages.csv").async("string");
    const records = csvParse(pages, {
      columns: true,
      skip_empty_lines: true,
    });
    expect(records[0]).toStrictEqual({
      basename: "a-news-entry",
      body: "",
      cf_mt_net_field1: "",
      cf_mt_net_field2: "",
      "convert breaks": "__default__",
      date: "2019-06-01 20:28:54",
      "extended body": "",
      status: "Publish",
      title: "A news entry",
      type: "Page",
    });
  });

  test("wp4: __default__", async () => {
    const conv = new Converter();
    conv.addDocument(fs.readFileSync(__dirname + "/dataset/wp4.xml", "utf8"));

    const zip = await conv.export({
      postTypeMap: {
        post: "post",
        page: "",
        news: "",
      },
      customFieldMap: {
        field1: "mt_net_field1",
        field2: "mt_net_field2",
      },
      convertBreaks: "__default__",
      dirname: "test",
    });

    const posts = await zip.file("test/posts.csv").async("string");
    const records = csvParse(posts, {
      columns: true,
      skip_empty_lines: true,
    });
    expect(records[1]).toStrictEqual({
      basename: "",
      body: `本文本文

`,
      category: "カテゴリ名",
      cf_mt_net_field1: "",
      cf_mt_net_field2: "",
      "convert breaks": "__default__",
      date: "2019-05-30 17:21:10",
      "extended body": `

続き続き`,
      status: "Draft",
      title: "テスト投稿",
      type: "Post",
    });
  });

  test("wp4: richtext", async () => {
    const conv = new Converter();
    conv.addDocument(fs.readFileSync(__dirname + "/dataset/wp4.xml", "utf8"));

    const zip = await conv.export({
      postTypeMap: {
        post: "post",
        page: "",
        news: "",
      },
      customFieldMap: {
        field1: "mt_net_field1",
        field2: "mt_net_field2",
      },
      convertBreaks: "richtext",
      dirname: "test",
    });

    const posts = await zip.file("test/posts.csv").async("string");
    const records = csvParse(posts, {
      columns: true,
      skip_empty_lines: true,
    });
    expect(records[1]).toStrictEqual({
      basename: "",
      body: `<p>本文本文</p>
`,
      category: "カテゴリ名",
      cf_mt_net_field1: "",
      cf_mt_net_field2: "",
      "convert breaks": "richtext",
      date: "2019-05-30 17:21:10",
      "extended body": `
<p>続き続き</p>
`,
      status: "Draft",
      title: "テスト投稿",
      type: "Post",
    });
  });
});
