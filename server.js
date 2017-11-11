var express = require('express');
var app = express();
var path = require('path');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var axios = require('axios');

var engine = process.env.ENGINE_ID,
    search_key = process.env.SEARCH_KEY,
    mongoURI = process.env.MONGOLAB_URI;
var search_url = "https://www.googleapis.com/customsearch/v1";

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/views/index.html'));
});

// get JSON of search results
app.get('/api/imagesearch/:search?', function (req, res) {
  var search_str = req.params.search,
      offset = req.query.offset || 1;

  MongoClient.connect(mongoURI, function(err, db){
    assert.equal(null, err);
    console.log("Successfully connected to MongoDB.");

    var item = {
      term: search_str,
      when: new Date()
    };

    db.collection("history").insertOne(item).then(function(r){
      assert.equal(1, r.insertedCount);
      console.log("Item successfully inserted");
      db.close();
    });
  });

  axios.get(search_url, {
    params: {
      cx: engine,
      q: search_str,
      key: search_key,
      num: 10,
      searchType: "image",
      start: offset
    }
  })
  .then(function (response) {
    console.log('Response received');
    var results = response.data.items;

    var processed = results.reduce((acc, curr) => {
      return acc.concat([{
        url: curr.link,
        snippet: curr.snippet,
        thumbnail: curr.image.thumbnailLink,
        context: curr.image.contextLink
      }]);
    }, []);

    res.json(processed);
  })
  .catch(function (error){
    console.log(error);
  });
});


// get JSON of the most recently submitted strings
app.get('/api/latest', function (req, res){
  MongoClient.connect(mongoURI, function(err, db){
    assert.equal(null, err);
    console.log("Successfully connected to MongoDB.");

    db.collection('history').find()
    .sort({when: -1})
    .limit(10)
    .project({term: 1, when: 1, "_id": 0})
    .toArray(function (err, docs) {
      assert.equal(null, err);
      assert.notEqual(docs.length, 0);

      db.close();
      res.json(docs);
    });
  });
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
