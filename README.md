# LoL-Ranked-2020-Win-Prediction
Try to predict ranked game outcome at match making time

## Data Source
https://www.kaggle.com/d4sein/league-of-legends-patch-109

All ranked games data from Season 10 (2020)

## Data Dictionary
https://developer.riotgames.com/apis#match-v4/GET_getMatch

Explain what each field means in the raw dataset

## Database
https://www.mongodb.com/

## Setup
1) Download the raw data from kaggle (link above)
2) Create `lol` database in MongoDB and load in the raw data
3) Run setupDB.js with MongoDB
4) Run etl.js with `mongo --quiet lol etl.js > games.json` to create dataset used for post game analysis (printAllGames function)
5) Run etl,js with `mongo --quiet lol etl.js > history.json` to create dataset used for pre game analysis (prepPreGames function)
6) Run the 2 jupyter notebooks for analysis

## Analysis
See presentation.pptx
