import DDBMuncher from "../../muncher/DDBMuncher.js";
import { DDBSetup, DDBCookie, isSetupComplete, isValidKey } from "../../lib/Settings.js";
import { checkCobalt } from "../../lib/Secrets.js";

export function addMuncher(app, html) {
  if (app.options.id == "compendium" && game.user.isGM) {
    let button = $("<div class='header-actions action-buttons flexrow'><button class='ddb-muncher'><i class='fas fa-pastafarianism'></i> DDB Muncher</button></div>");

    button.click(async () => {
      ui.notifications.info("Checking your DDB details - this might take a few seconds!");
      const setupComplete = isSetupComplete();

      if (setupComplete) {
        const cobaltStatus = await checkCobalt();
        if (cobaltStatus.success) {
          let validKey = await isValidKey();
          if (validKey) {
            new DDBMuncher().render(true);
          }
        } else {
          new DDBCookie().render(true);
        }
      } else {
        game.settings.set("ddb-importer", "settings-call-muncher", true);
        new DDBSetup().render(true);
      }
    });

    const top = game.settings.get("ddb-importer", "show-munch-top");
    if (top) {
      $(html).find(".directory-header").append(button);
    } else {
      $(html).find(".directory-footer").append(button);
    }
  }
}
