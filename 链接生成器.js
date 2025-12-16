const urlarray = [];
const uuid = "e583ef48-19fe-4bce-b786-af30f43be840";
const 优选域名 = [
  "www.wto.org",
  "icook.hk",
  "cloudflare.182682.xyz",
  "tunnel.icmp9.com",
  "cf.877774.xyz",
  "[2a06:98c1:3102::6812:29be]",
  "[2606:4700:4406::ac40:9242]",
  "2606:4700:4401::8a1:73ee",
  "2606:4700:54::6346:2b8c",
  "2606:4700:4409::2bc8:6efc",
  "2606:4700:4407::be:33dd",
  "2606:4700:4405::6ba6:5410",
  "2a06:98c1:3102::6812:29be",
  "2606:4700:4406::ac40:9242",
  "2606:4700:3037::ac43:a168",
  "2606:4700:3031::6815:5ad2",
  "2606:4700:3030::ac43:8fc5",
  "2606:4700:3037::6815:2f11",
];
const online = JSON.parse(await fs.promises.readFile("online.json", "utf-8"));
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
  }
}
import fs from "fs";
await fs.promises.writeFile("分享链接.txt", urlarray.join("\n"));
