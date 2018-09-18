const cheerio = require('cheerio');
const request = require('request');
const fs = require('fs');
const path = require('path');

/**根据分页码，获取楼盘信息， 主要提取楼盘名字以及楼盘明细的地址 */
function getAllItems (page) {
    const base_url = 'https://www.cdfangxie.com/Infor/type/typeid/36.html?&p=' + page;
    return new Promise((resolve, reject) => {
        const items = [];
        request(base_url, (error, resp, body) => {
            if(!error && resp.statusCode === 200) {
                const $ = cheerio.load(body);
                const lis = $('.ul_list li');
                lis.map((i, d) => {
                  if(!$(d).hasClass('line')) {
                    const a = $('a', $(d))[0];
                    const span = $('span', $(d))[1];
                    items.push({
                        name : a.attribs.title,
                        href : a.attribs.href,
                        date : span.children[0].data
                    });
                  }
                });
            }
            resolve(items);
        });
    });
}

function getHouseDetail (name, url, date) {
  return new Promise((resolve, reject) => {
    request(url, (error, resp, body) => {
      if(!error && resp.statusCode === 200) {
        const $ = cheerio.load(body);
        const a = $('.MsoNormal a')[0];  
        resolve({
          name,
          date,
          href : a.attribs.href
        });
      }
    });
  });
}


/**
 * 下载房源文件
 * @param {*} option 
 */
function download (option = {}, index, total) {
  return new Promise((resolve, reject) => {
    const {name, href, date} = option;
    const dir = path.join(__dirname, '房源资料');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    const reg = /([^.]+)$/;
    const fileType = href.match(reg)[1];

    const names = name.split('|');

    const filename = '楼盘-' + date + '-' + names[0] + '-' + names[1] + '.' + fileType;

    const seq = index > 9 ? index : '0' + index;

    console.log('任务' + seq + ' === 开始下载第 ' + index + '/' + total + ' 个文件：' + filename);
    request(href).pipe(
      fs.createWriteStream(path.join(dir, filename))
    ).on('close', () => {
      console.log('任务' + seq + ' === 下载完成');
      resolve();
    });
  });
}

// 获取所有楼盘信息
async function getAllHouseInfo (pages = [1, 2]) {
  let result = [];
  for(let i=0; i<pages.length; i++){
    const res = await getAllItems(pages[i]);
    result = [...result, ...res];
  }

  let infos = [];
  for (let m=0; m<result.length; m++) {
    const info = await getHouseDetail(result[m].name, 'https://www.cdfangxie.com' + result[m].href, result[m].date);
    infos = [...infos, {...info}];
  }
  
  for(i=0; i<infos.length; i++){
    await download(infos[i], i+1, infos.length);
  }
  console.log('===================' + infos.length + '个文件已全部下载完成=================================');
  console.log('===================文件存放地址：' + path.join(__dirname, '房源资料') + '==================================');
}

getAllHouseInfo();