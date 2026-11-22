
global.document = { scripts: [], addEventListener() {} };
global.window = { location: { href: "http://localhost/" } };
const app = require("./script.js");
const fs = require("fs");
(async () => {
 const buf = fs.readFileSync("./De_Thi_Mau_Tin12.docx");
 const xml = await app.extractDocxDocumentXml(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength));
 console.log("xml", !!xml, xml?.length, xml?.includes("word") ? "xml-content" : "xml-empty");
 console.log("sample-text-markers", xml?.includes("Câu 1:"), xml?.includes("Câu 6:"));
})().catch(e=>{console.error(e);process.exit(1);});
