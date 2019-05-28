function getElementById(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) {
    throw Error(`${id} is not found`);
  }
  return e;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve((reader.result || "").toString());
    };

    reader.onerror = e => {
      reject(e.toString());
    };

    reader.readAsText(file);
  });
}

const MSG_MAP: { [key: string]: string } = {
  post: "記事",
  page: "ウェブページ",
};
function loc(msgid: string): string {
  return MSG_MAP[msgid] || msgid;
}

function getNodeValue(e: Element): string {
  return (e && e.childNodes[0] ? e.childNodes[0].nodeValue : "") || "";
}

function getNodeValueByTagName(e: Element, name: string): string {
  return [...e.getElementsByTagName(name)].map(e => getNodeValue(e)).join("");
}

export { getElementById, readFile, loc, getNodeValue, getNodeValueByTagName };
