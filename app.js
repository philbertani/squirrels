import GPU from "./GPU"

class App {
  header = "";
  data = [];
  squirrelFile = "2018_Central_Park_Squirrel_Census_-_Squirrel_Data.csv";
  canvas = null;
  latitudeHeader = "X";
  longitudeHeader = "Y";
  latitudeColumnNum;
  longitudeColumnNum; //mapped to 0 and 1
  coords = [];
  midPoints = [];
  gpu = null;
  zDataHeader = "Location"   //can be "Ground Plane" or "Above Ground" and some are blank
  zDataColumnNum;
  heightHeader = "Above Ground Sighter Measurement"
  heightColumnNum;

  //keep track of the points that are min and max latitude
  minPoint = [[0,0] , [0,0]]
  maxPoint = [[0,0] , [0,0]]

  constructor(csvFile) {
    console.log("apparently the document is loaded");
    this.canvas = document.getElementById("canvas");
    this.gpu = new GPU(this.canvas);

    //can NOT use the FileReader logic which is connected to the user
    //selecting a file, need to use a fetch/get
    const fileToLoad = csvFile ?? this.squirrelFile;
    this.loadLocalTextFile(fileToLoad);
  }

  loadLocalTextFile(url) {
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = "text";

    //we can append extra info to the req object
    //so pass in the this pointer for this class
    req.myThis = this;
    req.onload = function (e) {
      const myThis = this.myThis;
      const text = req.response.split("\n");
      myThis.header = text[0].split(",");
      for (let i = 1; i < text.length; i++) {
        //this will NOT work if there are quoted strings with commas
        //only for barebone csv files
        myThis.data.push(text[i].split(","));
      }
      myThis.analyze();
    };
    req.send();
  }

  analyze() {
    console.log(this.header);
    //find the header columns we are going to use, we know perfectly well that
    //we need columns 0 and 1 but let's assume we don't know to make it general
    //and driven by the header row
    this.header.forEach((x, i) => {
      if (x === this.latitudeHeader) this.latitudeColumnNum = i;
      else if (x === this.longitudeHeader) this.longitudeColumnNum = i;
      else if (x === this.zDataHeader) this.zDataColumnNum = i;
      else if (x === this.heightHeader) this.heightColumNum = i; //some measure of height
    });

    //I always use ii for indices pointing into arrays
    const ii = Array.from(this.header.length).fill(0);
    ii[this.latitudeColumnNum] = 0;
    ii[this.longitudeColumnNum] = 1;

    const columns = [this.latitudeColumnNum, this.longitudeColumnNum];
    const inf = 1e38;
    const [MIN, MAX] = [0, 1];
    let minMax = [
      [inf, -inf],
      [inf, -inf],
    ];

    console.log("minPoint",this.minPoint)
    for (let i = 0; i < this.data.length; i++) {
      const row = this.data[i];
      if (!row[columns[0]]) break; //there are some squirrely rows - hahaha

      for (const col of columns) {
        //ifnd the min,max for each column of interest
        const jj = ii[col];
        const num = parseFloat(row[col]);
        this.data[i][col] = num; //save it back as a number for use later
        if (num < minMax[jj][MIN]) {
          minMax[jj][MIN] = num;
          if (row[this.zDataColumnNum] === "Ground Plane") this.minPoint[jj][0]=i;
          else if (row[this.zDataColumnNum] === "Above Ground") this.minPoint[jj][1]=i;
        }
        else if (num > minMax[jj][MAX]) {
          minMax[jj][MAX] = num; 
          if (row[this.zDataColumnNum] === "Ground Plane") this.maxPoint[jj][0]=i;
          else  if (row[this.zDataColumnNum] === "Above Ground") this.maxPoint[jj][1]=i;
        } 
      }
    }

    for (const col of columns) {
      const jj = ii[col];
      console.log(minMax[jj]);
      console.log(Math.abs(minMax[jj][MAX] - minMax[jj][MIN])); //range
      console.log((minMax[jj][MIN] + minMax[jj][MAX]) / 2);

      this.midPoints.push((minMax[jj][MIN] + minMax[jj][MAX]) / 2);
    }

    let count = 0
    //finally compute the X,Y coordinates we can use for display
    for (const row of this.data) {
      let coord = [];
      for (const col of columns) {
        const jj = ii[col];
        //multiplying by 100 generally puts the max in the range of 1,2
        coord.push((row[col] - this.midPoints[jj]) * 100);
      }
      const zDataText = row[this.zDataColumnNum]
  
      if (zDataText === "Ground Plane") coord.push(0)  //squirrels on the ground
      else if (zDataText === "Above Ground") {
        const height = parseFloat(row[this.heightColumNum])

        if ( !Number.isNaN(height) && height >= 0) {
          coord.push(.1+height/30)
        } 
        else {
          coord.push(.1)  //squirrels in trees apparently
          count ++
        }
      }
      else coord.push( Math.trunc(Math.random()*2 )) 
      this.coords.push(coord);
    }

    console.log('zzzzzzzzzzzz count of trees', count);

    this.gpu.createScene(this.coords, this.minPoint);
    this.gpu.render();
  }
}

export default App
