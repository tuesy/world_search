# World Search App

![World Search Promo](https://github.com/tuesy/world_search/blob/main/promo.png?raw=true)

World Search is an MRE app that allows Altspace users to search public Worlds. You can search for words in the name or description. You can even search for a particular user's worlds using their username. Fuzzy matching is available.

There's a demo Altspace world here: https://account.altvr.com/worlds/1046572460192825569/spaces/1597073609157771872

# Usage

This app is featured so you can place it in your Worlds using the World Editor (Featured > SDK Apps > Page 2):

![World Editor Screenshot](https://github.com/tuesy/world_search/blob/main/world_editor_screenshot.png?raw=true)

You can also place it manually using:

> wss://mankindforward-world-search.herokuapp.com

You can pass a parameter to preconfigure a search:

> wss://mankindforward-world-search.herokuapp.com?q=jimmy

# Development
* Fork this repo
* Create a Heroku app and link it to your github repo
* Enable auto deploys from github
* In Altspace:
  * Open World Editor > Altspace > Basics > SDK App
  * `ws://<your subdomain>.herokuapp.com` (port 80)
  * Click Confirm
