/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from '@microsoft/mixed-reality-extension-sdk';

const fetch = require('node-fetch');
const url = require('url')
const SEARCH_URL = 'https://account.altvr.com/api/public/spaces/search?'
const WELCOME_TEXT = 'World Search App';
const INFO_TEXT_HEIGHT = 1.2;
const BUTTON_HEIGHT = 0.6;
const TELEPORTER_BASE = -0.5;
const SAMPLE_QUERY = 'whimwhams'; // Nera's stuff
const WORLD_BUILDERS_LIST_ROTATION = -30;
const TRUNCATE_FIRST_NAME = 15;

// Buttons Kit - https://account.altvr.com/kits/1579230775574790691


/**
 * The structure of a world entry in the world database.
 */
type WorldDescriptor = {
    description: string;
    favorited: number;
    image: string;
    name: string;
    userDisplayName: string;
    userUsername: string;
    visited: number;
    worldId: string;
};

/**
 * The main class of this app. All the logic goes here.
 */
export default class WorldSearch {
	private assets: MRE.AssetContainer;

  private libraryActors: MRE.Actor[] = [];

  // Load the database.
  // tslint:disable-next-line:no-var-requires variable-name
  private worldDatabase: { [key: string]: WorldDescriptor } = {};

  private teleporterSpacing = 0.8;
  private teleporterScale = {x: 0.5, y: 0.5, z: 0.5};
  private maxResults = 25;
  private previewImageWidth = 1.4;
  private previewImageHeight = 1;
  private previewImageDepth = 0.02;
  private previewImagePosition = {y: 2};
  private moreInfoHeight = 0.2;
  private moreInfoPosition = {y: 2.8};
  private infoText : any;
  private worldBuildersListEnabled = false;
  private worldBuildersList : any;

	constructor(private context: MRE.Context, private params: MRE.ParameterSet) {
		this.context.onStarted(() => this.started());
	}

	/**
	 * Once the context is "started", initialize the app.
	 */
	private async started() {
		// set up somewhere to store loaded assets (meshes, textures, animations, gltfs, etc.)
		this.assets = new MRE.AssetContainer(this.context);

    this.createInterface();

    // allow the user to preset a query
    if(this.params.q){
      this.search(String(this.params.q));
    }
	}

  private createInterface(){
    this.infoText = MRE.Actor.Create(this.context, {
      actor: {
        name: 'Info Text',
        transform: { local: { position: { x: 0, y: INFO_TEXT_HEIGHT, z: 0 } } },
        collider: { geometry: { shape: MRE.ColliderType.Box, size: { x: 0.5, y: 0.2, z: 0.01 } } },
        text: {
          contents: WELCOME_TEXT,
          height: 0.1,
          anchor: MRE.TextAnchorLocation.MiddleCenter,
          justify: MRE.TextJustify.Center
        }
      }
    });

    const favoritesButton = MRE.Actor.CreateFromLibrary(this.context, {
      resourceId: 'artifact:1579238678213952234',
      actor: {
        name: 'Help Button',
        transform: { local: { position: { x: -0.35, y: BUTTON_HEIGHT, z: 0 } } },
        collider: { geometry: { shape: MRE.ColliderType.Box, size: { x: 0.5, y: 0.2, z: 0.01 } } }
      }
     });
    favoritesButton.setBehavior(MRE.ButtonBehavior).onClick(user => {
      if(this.worldBuildersListEnabled){
        this.worldBuildersList.destroy();
        this.worldBuildersListEnabled = false;
      }
      else{
        this.createWorldBuildersList();
        this.worldBuildersListEnabled = true;
      }
    });

    const helpButton = MRE.Actor.CreateFromLibrary(this.context, {
      resourceId: 'artifact:1579238405710021245',
      actor: {
        name: 'Help Button',
        transform: { local: { position: { x: 0.35, y: BUTTON_HEIGHT, z: 0 } } },
        collider: { geometry: { shape: MRE.ColliderType.Box, size: { x: 0.5, y: 0.2, z: 0.01 } } }
      }
     });
    helpButton.setBehavior(MRE.ButtonBehavior).onClick(user => {
      user.prompt(`
This app allows you to search for public Worlds by name, description, tag, username, etc.

Click "OK" for an example.

Click the hashtag button to search.

Click the heart button to see top world builders. Click the small heart button next to a name to search their for Worlds.
`).then(res => {
          if(res.submitted){
            this.infoText.text.contents = this.resultMessageFor(SAMPLE_QUERY);
            this.search(SAMPLE_QUERY);
          }
          else
            this.infoText.text.contents = WELCOME_TEXT;
      })
      .catch(err => {
        console.error(err);
      });
    });

    const hashtagButton = MRE.Actor.CreateFromLibrary(this.context, {
      resourceId: 'artifact:1579239194507608147',
      actor: {
        name: 'Search Button',
        transform: { local: { position: { x: 0, y: BUTTON_HEIGHT, z: 0 } } },
        collider: { geometry: { shape: MRE.ColliderType.Box, size: { x: 0.5, y: 0.2, z: 0.01 } } }
      }
    });
    hashtagButton.setBehavior(MRE.ButtonBehavior).onClick(user => {
      user.prompt(`
Enter a search term and click "OK"
(e.g. 'tidal' or 'babayaga').`, true)
      .then(res => {

          if(res.submitted && res.text.length > 0){
            this.infoText.text.contents = this.resultMessageFor(res.text);
            this.search(res.text);
          }
          else{
            // user clicked 'Cancel'
          }

      })
      .catch(err => {
        console.error(err);
      });
    });
  }

  private createWorldBuildersList(){
    let x = 0;
    let y = 0;

    this.worldBuildersList = MRE.Actor.Create(this.context, {
      actor: {
        transform: {
          local: {
            position: { x: -2, y: y, z: 0 },
            rotation: MRE.Quaternion.FromEulerAngles(0, WORLD_BUILDERS_LIST_ROTATION * MRE.DegreesToRadians, 0)
          }
        }
      }
    });

    // create favorites board
    // => created from the buttom up
    // UPDATED: 2021-06-02
    let worldBuilders: string[][] = [
      ["Daisy Shaw", "BestBearEver"],
      ["Darren", "VRDarrenG"],
      ["Matty Boy", "MattyBoy"],
      ["tajasuka", "tajasuka"],
      ["Karnivore", "markgill47"],
      ["Kbot", "kvanalstine"],
      ["{Mr. Disney}", "TheVoiceGuy1"],
      ["Artsy (MC)", "artsy"],
      ["SHUSHU", "HOLODRAMA"],
      ["Andy", "djvivid"],
      ["VRMax Technologies Solutions", "VRMaxTech"],
      ["Mr. Prime", "OctopusPrime"],
      ["Lightyear (Scott) World Builder/Musician", "scottfin767"],
      ["MOLLY (Queen of Hearts)", "GypsySoul"],
      ["James", "Velox"],
      ["Nera", "whimwhams"],
      ["Hazel", "DuncanEyes"],
      ["Luis Neo Buda", "LuisNeoBuda"],
      ["Terry", "TerryVallery"],
      ["Doug - BRCvr )*(", "Dougj11"],
      ["HartmanVR", "Hartman747"],
      ["OptiC", "OptiC_AltspaceVR"],
      ["Evgeniya", "Evinewyork"],
      ["Olly", "Olly"],
      ["WALLY", "WALLY1987"],
    ].reverse();
    let button = null;
    for(var user of worldBuilders){
      let first_name = user[0];
      if(first_name.length > TRUNCATE_FIRST_NAME)
        first_name = first_name.slice(0, TRUNCATE_FIRST_NAME) + '...';

      let username = user[1];
      let display_name = `${first_name} (${username})`;

      button = MRE.Actor.CreateFromLibrary(this.context, {
        resourceId: 'artifact:1579238678213952234', // heart
        actor: {
          transform: { local: { position: { x: x, y: y, z: 0 }, scale: {x: 0.5, y: 0.5 , z: 0.5 } } },
          collider: { geometry: { shape: MRE.ColliderType.Box, size: { x: 0.5, y: 0.2, z: 0.01 } } },
          parentId: this.worldBuildersList.id
        }
      });
      button.setBehavior(MRE.ButtonBehavior).onClick(user => {
        this.infoText.text.contents = this.resultMessageFor(username);
        this.search(username);
      });

      MRE.Actor.Create(this.context, {
        actor: {
          transform: { local: { position: { x: x + 0.1, y: y, z: 0 } } },
          collider: { geometry: { shape: MRE.ColliderType.Box, size: { x: 0.5, y: 0.2, z: 0.01 } } },
          text: {
            contents: display_name,
            height: 0.1,
            anchor: MRE.TextAnchorLocation.MiddleLeft,
            justify: MRE.TextJustify.Left
          },
          parentId: this.worldBuildersList.id
        }
      });


      y += 0.15;
    }

    // title
    y += 0.1;
    MRE.Actor.Create(this.context, {
      actor: {
        transform: { local: { position: { x: x, y: y, z: 0 } } },
        collider: { geometry: { shape: MRE.ColliderType.Box, size: { x: 0.5, y: 0.2, z: 0.01 } } },
        text: {
          contents: 'Top World Builders',
          height: 0.15,
          anchor: MRE.TextAnchorLocation.MiddleLeft,
          justify: MRE.TextJustify.Left
        },
        parentId: this.worldBuildersList.id
      }
    });
  }

  private resultMessageFor(query: string){
    return `Search results for "${query}"`;
  }

	// search for worlds and spawn teleporters
	private search(query: string) {
		// TODO: remove existing teleporters
    // testings

    // clear existing teleporters
		for (const actor of this.libraryActors) {
			actor.destroy();
		}

		// clear world data
		this.worldDatabase = {};

		// query public worlds search api
		let uri = SEARCH_URL + new url.URLSearchParams({ q: query, per: this.maxResults });
    fetch(uri)
	    .then((res: any) => res.json())
	    .then((json: any) => {
	    	// console.log(json);
        if(json.spaces){
          for(const world of json['spaces']){
              this.worldDatabase[world.space_id] = {
                  'description': String(world.description),
                  'favorited': Number(world.favorited),
                  'image': String(world.image_large),
                  'name': String(world.name),
                  'userDisplayName': String(world.first_name),
                  'userUsername': String(world.username),
                  'visited': Number(world.visited),
                  'worldId': String(world.space_id)
              }
          }

          // where all the magic happens
          // Loop over the world database, creating a teleporter for each entry.
          let x = this.teleporterSpacing;
          for (const worldId of Object.keys(this.worldDatabase)) {
              const worldRecord = this.worldDatabase[worldId];

              this.spawn('Teleporter to ' + worldRecord.name, worldId,
                  { x: x, y: 0.0, z: 0.0}, { x: 0.0, y: 180, z: 0.0}, this.teleporterScale)
              x += this.teleporterSpacing;
          }
        }
        else if (json.status == '404'){
          // 404 is a normal HTTP response so you can't 'catch' it
          console.log("ERROR: received a 404 for " + uri)
        }
	    });
	}

  private spawn(name: string, worldId: string, position: any, rotation: any, scale: any){
    let world = this.worldDatabase[worldId];

  	// spawn teleporter
  	let tp = MRE.Actor.CreateFromLibrary(this.context, {
        resourceId: 'teleporter:space/' + worldId + '?label=true',
        actor: {
            name: name,
            transform: {
                local: {
                    position: position,
                    rotation: MRE.Quaternion.FromEulerAngles(
                        rotation.x * MRE.DegreesToRadians,
                        rotation.y * MRE.DegreesToRadians,
                        rotation.z * MRE.DegreesToRadians),
                    scale: scale
                }
            }
        }
    });
    this.libraryActors.push(tp);

    // spawn info button
		const noTextButton = MRE.Actor.Create(this.context, {
			actor: {
				name: 'noTextButton',
				parentId: tp.id,
				transform: {
					local: {
						position: this.moreInfoPosition,
						rotation: MRE.Quaternion.FromEulerAngles(
		          rotation.x * MRE.DegreesToRadians,
		          rotation.y * MRE.DegreesToRadians,
		          rotation.z * MRE.DegreesToRadians)
					}
				},
				collider: { geometry: { shape: MRE.ColliderType.Box, size: { x: 0.5, y: 0.2, z: 0.01 } } },
				text: {
					contents: "More Info",
					height: this.moreInfoHeight,
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					justify: MRE.TextJustify.Center
				}
			}
		});
		noTextButton.setBehavior(MRE.ButtonBehavior).onClick(user => {
			let info = `${world.name}\n\nBy ${world.userDisplayName} (${world.userUsername})`;

			if(typeof world.description !='undefined' && world.description){
   			info += `\n\n${world.description}`;
			}

			info += `\n\nFavorited ${world.favorited} | Visited ${world.visited}`;

			user.prompt(info)
			.then(res => {
				// noTextButton.text.contents =
				// 	`Click for message\nLast response: ${res.submitted ? "<ok>" : "<cancelled>"}`;
			})
			.catch(err => {
				console.error(err);
			});
		});

    // spawn preview image
    const tex = this.assets.createTexture('previewTexture', {uri: world.image});
    const mat = this.assets.createMaterial('previewMaterial', {
      color: MRE.Color3.Black(),
      emissiveColor: MRE.Color3.White(),
      emissiveTextureId: tex.id
    });
    const mesh = this.assets.createBoxMesh('window', this.previewImageWidth, this.previewImageHeight, this.previewImageDepth);
    MRE.Actor.Create(this.context, {
      actor: {
        name: 'window',
        parentId: tp.id,
        appearance: {
          meshId: mesh.id,
          materialId: mat.id
        },
        transform: {
          local: {
            position: this.previewImagePosition
          }
        }
      }
    });
  }
}
