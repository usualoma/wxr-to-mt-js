import "@webcomponents/template";
import { saveAs } from "file-saver";
import domReady from "domready";

import "./app.scss";
import { getElementById, readFile, loc } from "./util";
import Converter, { PostType, ConvertBreaks } from "./Converter";

class App {
  private src: HTMLElement;
  private file: HTMLInputElement;
  private download: HTMLButtonElement;
  private readFilePromise?: Promise<Converter>;

  public constructor() {
    this.src = getElementById("src");
    this.file = getElementById("file") as HTMLInputElement;
    this.download = getElementById("download") as HTMLButtonElement;
  }

  private showDropping(): void {
    this.src.classList.add("dropover");
  }

  private hideDropping(): void {
    this.src.classList.remove("dropover");
  }

  private handleFiles(files: FileList | null): void {
    if (!files || files.length === 0) {
      return;
    }

    const promise = (this.readFilePromise = Promise.all([...files].map(
      (f: File) => readFile(f)
    ) as Promise<string>[]).then((strs: string[]) => {
      const conv = new Converter();
      strs.forEach(str => conv.addDocument(str));
      return conv;
    }));

    promise.then(conv => {
      const content = (getElementById("post-type") as HTMLTemplateElement)
        .content;
      const list = getElementById("post-types");

      conv.postTypes().forEach(t => {
        const clone = document.importNode(content, true);
        clone.querySelectorAll("span")[0].textContent = t;
        const select = clone.querySelectorAll("select")[0];

        select.name = `post-types[${t}]`;
        select.appendChild(document.createElement("option")); // blank

        Object.keys(PostType).forEach(o => {
          const option = document.createElement("option");
          option.value = o;
          option.appendChild(document.createTextNode(loc(o)));
          if (t === o) {
            option.selected = true;
          }
          select.appendChild(option);
        });

        list.appendChild(clone);
      });
    });

    promise.then(conv => {
      const content = (getElementById("custom-field") as HTMLTemplateElement)
        .content;
      const list = getElementById("custom-fields");

      conv.customFields().forEach(t => {
        const clone = document.importNode(content, true);
        clone.querySelectorAll("span")[0].textContent = t;
        const input = clone.querySelectorAll("input")[0];

        input.name = `custom-fields[${t}]`;
        input.value = t.replace(/-/g, "_").replace(/[^0-9a-zA-Z_]/g, "");

        list.appendChild(clone);
      });
    });

    promise.then(() => {
      getElementById("actions").classList.remove("d-none");
    });
  }

  public run(): void {
    this.download.addEventListener("click", async ev => {
      ev.preventDefault();

      if (!this.readFilePromise) {
        return;
      }

      const ymdhm = (() => {
        const dt = new Date();
        const y = dt.getFullYear();
        const m = ("00" + (dt.getMonth() + 1)).slice(-2);
        const d = ("00" + dt.getDate()).slice(-2);
        const h = ("00" + (dt.getHours() + 1)).slice(-2);
        const min = ("00" + dt.getMinutes()).slice(-2);
        return y + m + d + h + min;
      })();

      const name = `mt-import-data-${ymdhm}`;

      const postTypeMap: { [key: string]: PostType } = {};
      document.querySelectorAll(`select[name^="post-types"]`).forEach(e => {
        const s = e as HTMLSelectElement;

        if (s.value === "") {
          return;
        }

        const m = s.name.match(/\[(.*)\]/);
        if (!m) {
          return;
        }

        postTypeMap[m[1]] = s.value as PostType;
      });

      const customFieldMap: { [key: string]: string } = {};
      document.querySelectorAll(`input[name^="custom-fields"]`).forEach(e => {
        const i = e as HTMLInputElement;

        if (i.value === "") {
          return;
        }

        const m = i.name.match(/\[(.*)\]/);
        if (!m) {
          return;
        }

        customFieldMap[m[1]] = i.value;
      });

      const conv = await this.readFilePromise;
      const zip = await conv.export({
        postTypeMap,
        customFieldMap,
        dirname: name,
        convertBreaks: (getElementById("convert-breaks") as HTMLSelectElement)
          .value as ConvertBreaks,
      });
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${name}.zip`);
    });

    this.src.addEventListener("dragover", ev => {
      if (!ev.dataTransfer) {
        return;
      }

      ev.preventDefault();
      ev.dataTransfer.dropEffect = "copy";
      this.showDropping();
    });

    this.src.addEventListener("dragleave", () => {
      this.hideDropping();
    });

    this.src.addEventListener("drop", ev => {
      if (!ev.dataTransfer) {
        return;
      }

      ev.preventDefault();
      this.hideDropping();

      const files = ev.dataTransfer.files;
      this.handleFiles(files);
    });

    this.file.addEventListener("change", () => {
      this.handleFiles(this.file.files);
    });
  }
}

domReady(() => {
  new App().run();
});
