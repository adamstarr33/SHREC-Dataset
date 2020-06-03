const superagent = require('superagent');
const process = require('process');
const fs = require('fs');

const TOKEN = process.env.token || 'REPLACE_WITH_YOUR_TOKEN';
const BASE_URL = 'https://api.discogs.com';
const AUTH_HEADER = `Discogs token=${TOKEN}`;
const DATA_DIR = './data';

const apiGet = async ({path, query}, type='application/json') => {
  return superagent
    .get(`${BASE_URL}${path}${query}`)
    .set('Authorization', AUTH_HEADER)
    .set('User-Agent', 'SHREC_SURG_AlbumDataset/0.1 +https://nsf-shrec.org')
};

const unravelResults = (res) => {
  const genreMap = {};
  res.results.forEach((item, i) => {
    item.genre.forEach((genre, i) => {
      if (!genreMap[genre]) {
        genreMap[genre] = [];
      }
      genreMap[genre].push(item.thumb);
    });
  });
  return genreMap;
}

const sampleGenre = async (genre, total=5) => {
  const res = await apiGet({
    path: '/database/search',
    query: `?q=&genre=${genre}`,
  });

  // https://www.discogs.com/developers/#page:home,header:home-general-information
  const limit = res.headers['x-discogs-ratelimit'];
  const remaining = res.headers['x-discogs-ratelimit-remaining'];
  const used = res.headers['x-discogs-ratelimit-used'];

  const rateHealth = used / limit;
  const remainingRequests = remaining;

  const result = {
    rateHealth,
    remainingRequests,
    results: res.body.results,
  }
  return unravelResults(result);
}

const saveResults = async (genreMap) => {
  const map = await genreMap;
  await Promise.all(Object.entries(map).map(async ([genre, array]) => {

    if (!fs.existsSync(DATA_DIR)){
        fs.mkdirSync(DATA_DIR);
    }

    const genreDir = `${DATA_DIR}/${genre}`;
    if (!fs.existsSync(genreDir)){
        fs.mkdirSync(genreDir);
    }

    return await Promise.all(array.map(async (url, i) => {
      const imgStream = fs.createWriteStream(`${genreDir}/${i}.jpg`);
      const req = superagent.get(url)
      .set('Authorization', AUTH_HEADER)
      .set('User-Agent', 'SHREC_SURG_AlbumDataset/0.1 +https://nsf-shrec.org');
      req.type('image/jpeg');

      req.pipe(imgStream);
    }));
  }));
}

const genres = ['rock', 'hip-hop', 'r&b', 'pop', 'country'];

genres.forEach((genre) => {
  saveResults(sampleGenre(genre, 100));
});
