import { promisify } from "es6-promisify";
import wpautop from "wpautop";
import JSZip from "jszip";
import csvStringify from "csv-stringify";
const csvStringifyAsync = promisify(csvStringify) as (
  data: {}[],
  options: {}
) => Promise<string>;

import { getNodeValue, getNodeValueByTagName } from "./util";

enum PostType {
  post = "post",
  page = "page",
}

enum ConvertBreaks {
  __default__ = "__default__",
  richtext = "richtext",
}

interface ExportConfig {
  postTypeMap: { [key: string]: PostType };
  customFieldMap: { [key: string]: string };
  convertBreaks?: ConvertBreaks;
  dirname?: string;
}

interface FileData {
  filename: string;
  data: string;
}

class Converter {
  private documents: Document[] = [];

  public addDocument(doc: Document | string): void {
    if (!(doc instanceof Document)) {
      const parser = new DOMParser();
      doc = parser.parseFromString(doc, "application/xml");
    }

    this.documents.push(doc);
  }

  public postTypes(): string[] {
    return this.documents
      .map(d =>
        [...d.getElementsByTagName("wp:post_type")].map((t: Element) =>
          getNodeValue(t)
        )
      )
      .flat()
      .filter(Boolean)
      .filter((v, i, self) => self.indexOf(v) === i); // unique;
  }

  public customFields(): string[] {
    return this.documents
      .map(
        d =>
          [...d.getElementsByTagName("wp:meta_key")]
            .map((t: Element) => getNodeValue(t))
            .filter(k => !k.match(/^_/)) // exclude private meta keys
      )
      .flat()
      .filter(Boolean)
      .filter((v, i, self) => self.indexOf(v) === i); // unique;
  }

  public export(conf: ExportConfig): Promise<JSZip> {
    return new Promise(resolve => {
      const promises = [];

      const postTypes = Object.keys(conf.postTypeMap).filter(
        t => conf.postTypeMap[t] === PostType.post
      );
      const pageTypes = Object.keys(conf.postTypeMap).filter(
        t => conf.postTypeMap[t] === PostType.page
      );

      if (postTypes.length) {
        promises.push(this.exportCategory(), this.exportPost(conf, postTypes));
      }

      if (pageTypes.length) {
        promises.push(this.exportPage(conf, pageTypes));
      }

      const dirname = conf.dirname ? `${conf.dirname}/` : "";
      Promise.all(promises).then(results => {
        const zip = new JSZip();

        results.forEach(res => {
          if (!res) {
            return;
          }
          zip.file(`${dirname}${res.filename}`, res.data);
        });

        resolve(zip);
      });
    });
  }

  private exportCategory() {
    const columns = ["type", "label", "dirname", "description"];

    const objs: {}[] = [];
    this.documents.forEach(d => {
      [...d.getElementsByTagName("wp:category")].forEach((elm: Element) => {
        const label = getNodeValueByTagName(elm, "wp:cat_name");
        if (label === "未分類" || label === "Uncategorized") {
          return;
        }

        const dirname = [
          getNodeValueByTagName(elm, "wp:category_parent"),
          getNodeValueByTagName(elm, "wp:category_nicename"),
        ]
          .filter(Boolean)
          .join("/");

        objs.push({
          label,
          dirname,
          type: "Category",
          description: getNodeValueByTagName(elm, "wp:category_description"),
        });
      });
    });

    return this.csvStringify(objs, columns, "categories.csv");
  }

  private exportPost(conf: ExportConfig, types: string[]) {
    return this.exportPostPage(
      conf,
      "post",
      types,
      [
        "type",
        "title",
        "status",
        "convert breaks",
        "date",
        "basename",
        "category",
        "body",
        "extended body",
      ].concat(
        Object.keys(conf.customFieldMap).map(
          k => `cf_${conf.customFieldMap[k]}`
        )
      )
    );
  }

  private exportPage(conf: ExportConfig, types: string[]) {
    return this.exportPostPage(
      conf,
      "page",
      types,
      [
        "type",
        "title",
        "status",
        "convert breaks",
        "date",
        "basename",
        "body",
        "extended body",
      ].concat(
        Object.keys(conf.customFieldMap).map(
          k => `cf_${conf.customFieldMap[k]}`
        )
      )
    );
  }

  private exportPostPage(
    conf: ExportConfig,
    type: string,
    types: string[],
    columns: string[]
  ) {
    const convertBreaks = conf.convertBreaks || ConvertBreaks.__default__;

    const objs: {}[] = [];
    this.documents.forEach(d => {
      [...d.getElementsByTagName("item")].forEach((elm: Element) => {
        const postType = getNodeValueByTagName(elm, "wp:post_type");
        if (types.indexOf(postType) === -1) {
          return;
        }

        let date = getNodeValueByTagName(elm, "wp:post_date_gmt");
        if (date.match(/^0000/)) {
          // draft?
          date = getNodeValueByTagName(elm, "wp:post_date");
        }

        const obj: { [key: string]: string } = {
          type: type.charAt(0).toUpperCase() + type.slice(1),
          title: getNodeValueByTagName(elm, "title"),
          status:
            getNodeValueByTagName(elm, "wp:status").toLowerCase() === "publish"
              ? "Publish"
              : "Draft",
          "convert breaks": convertBreaks,
          basename: getNodeValueByTagName(elm, "wp:post_name"),
          date: date,
        };

        const contents = getNodeValueByTagName(elm, "content:encoded").split(
          /<!--more-->/,
          2
        );
        if (contents[0].match(/^<!-- wp:/)) {
          // edited by gutenberg ?
          [obj["body"], obj["extended body"]] = contents;
          obj["convert breaks"] = "richtext";
        } else if (convertBreaks === ConvertBreaks.richtext) {
          [obj["body"], obj["extended body"]] = contents.map(c => wpautop(c));
        } else {
          [obj["body"], obj["extended body"]] = contents;
        }

        const cats = [...elm.getElementsByTagName("category")].map(
          (cat: Element) => {
            const nicename = cat.getAttribute("nicename");
            if (
              !nicename ||
              nicename === "uncategorized" ||
              decodeURIComponent(nicename) === "未分類"
            ) {
              return;
            }

            return getNodeValue(cat);
          }
        );
        obj["category"] = cats.join("\n");

        [...elm.getElementsByTagName("wp:postmeta")].forEach(
          (meta: Element) => {
            const key = getNodeValueByTagName(meta, "wp:meta_key");
            if (!conf.customFieldMap[key]) {
              return;
            }

            obj[`cf_${conf.customFieldMap[key]}`] = getNodeValueByTagName(
              meta,
              "wp:meta_value"
            );
          }
        );

        objs.push(obj);
      });
    });

    return this.csvStringify(objs, columns, `${type}s.csv`);
  }

  private csvStringify(
    objs: {}[],
    columns: string[],
    filename: string
  ): Promise<FileData | void> {
    if (objs.length === 0) {
      return Promise.resolve();
    }

    return csvStringifyAsync(objs, { header: true, columns: columns }).then(
      data => ({
        filename,
        data,
      })
    );
  }
}

export { Converter as default, PostType, ConvertBreaks };
