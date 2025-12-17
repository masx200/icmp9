import fs from "fs";
import { 优选域名, 优选域名ipv4 } from "./优选域名.js";
const uuid = "e583ef48-19fe-4bce-b786-af30f43be840";
if (import.meta.main) {
  await generateipv6links();
  await generateipv4links();
}

async function generateipv6links() {
  const urlarray = [];

  const online = JSON.parse(await fs.promises.readFile("online.json", "utf-8"));
  // let count = 0;
  // loop:
  for (const item of online.countries) {
    //   const name = item.name;
    const code = item.code;
    for (const host of 优选域名) {
      const config = {
        v: "2",
        ps: "icmp9-" + code + "-" + host,
        add: host,
        port: "443",
        id: uuid,
        aid: "0",
        scy: "auto",
        net: "ws",
        type: "none",
        host: "tunnel.icmp9.com",
        path: "/" + code,
        tls: "tls",
        sni: "tunnel.icmp9.com",
        alpn: "h3,h2,http/1.1",
        insecure: "0",
      };
      // console.log(config);
      console.log("vmess://" + btoa(JSON.stringify(config)));
      urlarray.push("vmess://" + btoa(JSON.stringify(config)));

      // count++;
      // if (count > 3000) {
      //   break loop;
      // }
    }
  }
  await fs.promises.writeFile(
    "分享链接.txt",
    Array.from(new Set(urlarray)).join("\n"),
  );
}

async function generateipv4links() {
  const urlarray = [];

  const online = JSON.parse(await fs.promises.readFile("online.json", "utf-8"));
  // let count = 0;
  // loop:
  for (const item of online.countries) {
    //   const name = item.name;
    const code = item.code;
    for (const host of 优选域名ipv4) {
      const config = {
        v: "2",
        ps: "icmp9-" + code + "-" + host,
        add: host,
        port: "443",
        id: uuid,
        aid: "0",
        scy: "auto",
        net: "ws",
        type: "none",
        host: "tunnel.icmp9.com",
        path: "/" + code,
        tls: "tls",
        sni: "tunnel.icmp9.com",
        alpn: "h3,h2,http/1.1",
        insecure: "0",
      };
      // console.log(config);
      console.log("vmess://" + btoa(JSON.stringify(config)));
      urlarray.push("vmess://" + btoa(JSON.stringify(config)));

      // count++;
      // if (count > 3000) {
      //   break loop;
      // }
    }
  }
  await fs.promises.writeFile(
    "分享链接-ipv4.txt",
    Array.from(new Set(urlarray)).join("\n"),
  );
}
