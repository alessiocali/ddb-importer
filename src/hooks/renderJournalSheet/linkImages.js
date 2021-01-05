import utils from "../../utils.js";

function linkImages(html) {
  if (!game.user.isGM) return;
  const vttaInstalled = utils.isModuleInstalledAndActive("vtta-dndbeyond");
  if (vttaInstalled) return;

  // mark all images
  $(html)
    .find('div[data-edit="content"] img, div[data-edit="content"] video')
    .each((index, element) => {
      const showPlayersButton = $("<a class='vtta-button'><i class='fas fa-eye'></i>&nbsp;Show Players</a>");
      $(showPlayersButton).click(() => {
        const src = $(element).attr("src");
        game.socket.emit("module.ddb-importer", { sender: game.user.data._id, action: "showImage", src: src });
      });

      $(element).wrap("<div class='ddbimporter-image-container'></div>");
      // show the button on mouseenter of the image
      $(element)
        .parent()
        .mouseenter(function Hovering() {
          $(this).append(showPlayersButton);
          $(showPlayersButton).click(() => {
            const src = $(element).attr("src");
            game.socket.emit("module.ddb-importer", {
              sender: game.user.data._id,
              action: "showImage",
              src: src,
              type: element.nodeName,
            });
          });
        });
      $(element)
        .parent()
        .mouseleave(function Unhovering() {
          $(this).find("a").remove();
        });
    });
}

export default linkImages;
