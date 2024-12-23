import type { CSSResultGroup, PropertyValues, TemplateResult } from "lit";
// import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators";
import { DOMAINS_TOGGLE } from "../../../common/const";
import { applyThemesOnElement } from "../../../common/dom/apply_themes_on_element";
// import { computeDomain } from "../../../common/entity/compute_domain";
import "../../../components/ha-card";
import type { HomeAssistant } from "../../../types";
import { computeCardSize } from "../common/compute-card-size";
import { findEntities } from "../common/find-entities";
import { processConfigEntities } from "../common/process-config-entities";
import "../components/hui-entities-toggle";
import { createHeaderFooterElement } from "../create-element/create-header-footer-element";
import { createRowElement } from "../create-element/create-row-element";
import type {
  EntityConfig,
  LovelaceRow,
  LovelaceRowConfig,
} from "../entity-rows/types";
// import type {
//   LovelaceCard,
//   LovelaceCardEditor,
//   LovelaceHeaderFooter,
// // } from "../types";
// import type { EntitiesCardConfig } from "./types";

//vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
import { mdiExclamationThick, mdiHelp } from "@mdi/js";
import type { HassEntity } from "home-assistant-js-websocket";
import type { CSSResultGroup } from "lit";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import { ifDefined } from "lit/directives/if-defined";
import { styleMap } from "lit/directives/style-map";
import memoizeOne from "memoize-one";
import { computeCssColor } from "../../../common/color/compute-color";
import { hsv2rgb, rgb2hex, rgb2hsv } from "../../../common/color/convert-color";
import { DOMAINS_TOGGLE } from "../../../common/const";
import { computeDomain } from "../../../common/entity/compute_domain";
import { stateActive } from "../../../common/entity/state_active";
import { stateColorCss } from "../../../common/entity/state_color";
import "../../../components/ha-card";
import "../../../components/ha-ripple";
import "../../../components/ha-state-icon";
import "../../../components/ha-svg-icon";

import type { ActionHandlerEvent } from "../../../data/lovelace/action_handler";
import "../../../state-display/state-display";
import type { HomeAssistant } from "../../../types";

import { actionHandler } from "../common/directives/action-handler-directive";
import { findEntities } from "../common/find-entities";
import { handleAction } from "../common/handle-action";
import { hasAction } from "../common/has-action";
import type {
  LovelaceCard,
  LovelaceCardEditor,
  LovelaceGridOptions,
  LovelaceHeaderFooter,
} from "../types";
import type { EntitiesCardConfig } from "./types";

const DOMAIN_IMAGE_STYLE: Record<string, TileImageStyle> = {
  update: "square",
  media_player: "rounded-square",
};

@customElement("hui-entities-card")
export class HuiEntitiesCard extends LitElement implements LovelaceCard {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("../editor/config-elements/hui-entities-card-editor");
    return document.createElement("hui-entities-card-editor");
  }

  public static getStubConfig(
    hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[]
  ): EntitiesCardConfig {
    const maxEntities = 3;
    const includeDomains = ["sensor", "light", "switch"];
    const foundEntities = findEntities(
      hass,
      maxEntities,
      entities,
      entitiesFallback,
      includeDomains
    );

    return { 
      type: "entities", 
      entities: foundEntities | "",
    };
  }
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: EntitiesCardConfig;

  //private _hass?: HomeAssistant;

  private _configEntities?: LovelaceRowConfig[];

  //private _showHeaderToggle?: boolean;

  private _headerElement?: LovelaceHeaderFooter;

  private _footerElement?: LovelaceHeaderFooter;

  public setConfig(config: EntitiesCardConfig): void {
    if (!config.entities || !Array.isArray(config.entities)) {
      throw new Error("Specify entities");
    }

    const entities = processConfigEntities(config.entities);

    this._config = config;
    this._configEntities = entities;
    if (config.title !== undefined && config.show_header_toggle === undefined) {
      // Default value is show toggle if we can at least toggle 2 entities.
      let toggleable = 0;
      for (const rowConf of entities) {
        if (!("entity" in rowConf)) {
          continue;
        }
        toggleable += Number(DOMAINS_TOGGLE.has(computeDomain(rowConf.entity)));
        if (toggleable === 2) {
          break;
        }
      }
      this._showHeaderToggle = toggleable === 2;
    } else {
      this._showHeaderToggle = config.show_header_toggle;
    }

    if (this._config.header) {
      this._headerElement = createHeaderFooterElement(
        this._config.header
      ) as LovelaceHeaderFooter;
      this._headerElement.type = "header";
      if (this._hass) {
        this._headerElement.hass = this._hass;
      }
    } else {
      this._headerElement = undefined;
    }

    if (this._config.footer) {
      this._footerElement = createHeaderFooterElement(
        this._config.footer
      ) as LovelaceHeaderFooter;
      this._footerElement.type = "footer";
      if (this._hass) {
        this._footerElement.hass = this._hass;
      }
    } else {
      this._footerElement = undefined;
    }
  }
//vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
  public async getCardSize(): number> {
    return(
      1 +
      (this._config?.title ? 1 : 0) +
      (this._config?.show_header_toggle ? 1 : 0) +
      (this._config?.entities.length || 0) +
      (this._config?.header ? headerSize : 0) +
      (this._config?.footer ? footerSize : 0)
    );
  }

  public getGridOptions(): LovelaceGridOptions {
    const columns = 12;
    let min_columns = 12;
    let rows = 1;
    if (this._config?.entities.length) {
      rows += this._config.entities.length;
    }
    if (this._config?.header) {
      rows++;
      min_columns = 3;
    }
    if (this._config?.footer) {
      rows++;
      min_columns = 3;
    }
    return {
      columns,
      rows,
      min_columns,
      min_rows: rows,
    };
  }

  private _handleAction(ev: ActionHandlerEvent) {
    handleAction(this, this.hass!, this._config!, ev.detail.action!);
  }

  private _getImageUrl(entity: HassEntity): string | undefined {
    const entityPicture =
      entity.attributes.entity_picture_local ||
      entity.attributes.entity_picture;

    if (!entityPicture) return undefined;

    let imageUrl = this.hass!.hassUrl(entityPicture);
    if (computeDomain(entity.entity_id) === "camera") {
      imageUrl = cameraUrlWithWidthHeight(imageUrl, 80, 80);
    }

    return imageUrl;
  }

  private _computeStateColor = memoizeOne(
    (entity: HassEntity, color?: string) => {
      // Use custom color if active
      if (color) {
        return stateActive(entity) ? computeCssColor(color) : undefined;
      }

      // Use default color for person/device_tracker because color is on the badge
      if (
        computeDomain(entity.entity_id) === "person" ||
        computeDomain(entity.entity_id) === "device_tracker"
      ) {
        return undefined;
      }

      // Use light color if the light support rgb
      if (
        computeDomain(entity.entity_id) === "light" &&
        entity.attributes.rgb_color
      ) {
        const hsvColor = rgb2hsv(entity.attributes.rgb_color);

        // Modify the real rgb color for better contrast
        if (hsvColor[1] < 0.4) {
          // Special case for very light color (e.g: white)
          if (hsvColor[1] < 0.1) {
            hsvColor[2] = 225;
          } else {
            hsvColor[1] = 0.4;
          }
        }
        return rgb2hex(hsv2rgb(hsvColor));
      }

      // Fallback to state color
      return stateColorCss(entity);
    }
  );
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
protected render() {
  if (!this._config || !this._hass) {
    return nothing;
  }

  const title = this._config.title;
  const toggle = this.config.show_header_toggle;

  return html`
    <ha-card>
      div class="header-footer header">${this._headerElement}</div>
        <div class="card-header">
          <div class="icon-container">
            <ha-icon>
              <ha-svg-icon>
                <ha
        </div>
              <div class="name">
               <ha-icon
                        class="icon"
                        .icon=${this._config.icon}
                      ></ha-icon>
                    `
                  : ""}
                ${this._config.title}
              </div>
              ${!this._showHeaderToggle
                ? nothing
                : html`
                    <hui-entities-toggle
                      .hass=${this._hass}
                      .entities=${(
                        this._configEntities!.filter(
                          (conf) => "entity" in conf
                        ) as EntityConfig[]
                      ).map((conf) => conf.entity)}
                    ></hui-entities-toggle>
                  `}
            </h1>
          `}
      <div id="states" class="card-content">
        ${this._configEntities!.map((entityConf) =>
          this._renderEntity(entityConf)
        )}
      </div>

      ${this._footerElement
        ? html`<div class="header-footer footer">${this._footerElement}</div>`
        : ""}
    </ha-card>
  `;
}
  // protected render() {
  //   if (!this._config || !this._hass) {
  //     return nothing;
  //   }

  //   return html`
  //     <ha-card>
  //       ${this._headerElement
  //         ? html`<div class="header-footer header">${this._headerElement}</div>`
  //         : ""}
  //       ${!this._config.title && !this._showHeaderToggle && !this._config.icon
  //         ? ""
  //         : html`
  //             <h1 class="card-header">
  //               <div class="name">
  //                 ${this._config.icon
  //                   ? html`
  //                       <ha-icon
  //                         class="icon"
  //                         .icon=${this._config.icon}
  //                       ></ha-icon>
  //                     `
  //                   : ""}
  //                 ${this._config.title}
  //               </div>
  //               ${!this._showHeaderToggle
  //                 ? nothing
  //                 : html`
  //                     <hui-entities-toggle
  //                       .hass=${this._hass}
  //                       .entities=${(
  //                         this._configEntities!.filter(
  //                           (conf) => "entity" in conf
  //                         ) as EntityConfig[]
  //                       ).map((conf) => conf.entity)}
  //                     ></hui-entities-toggle>
  //                   `}
  //             </h1>
  //           `}
  //       <div id="states" class="card-content">
  //         ${this._configEntities!.map((entityConf) =>
  //           this._renderEntity(entityConf)
  //         )}
  //       </div>

  //       ${this._footerElement
  //         ? html`<div class="header-footer footer">${this._footerElement}</div>`
  //         : ""}
  //     </ha-card>
  //   `;
  // }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.shadowRoot
      ?.querySelectorAll("#states > div > *")
      .forEach((element: unknown) => {
        (element as LovelaceRow).hass = hass;
      });
    if (this._headerElement) {
      this._headerElement.hass = hass;
    }
    if (this._footerElement) {
      this._footerElement.hass = hass;
    }
    const entitiesToggle = this.shadowRoot?.querySelector(
      "hui-entities-toggle"
    );
    if (entitiesToggle) {
      (entitiesToggle as any).hass = hass;
    }
  }


  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this._config || !this._hass) {
      return;
    }
    const oldHass = changedProps.get("_hass") as HomeAssistant | undefined;
    const oldConfig = changedProps.get("_config") as
      | EntitiesCardConfig
      | undefined;

    if (
      (changedProps.has("_hass") &&
        (!oldHass || oldHass.themes !== this._hass.themes)) ||
      (changedProps.has("_config") &&
        (!oldConfig || oldConfig.theme !== this._config.theme))
    ) {
      applyThemesOnElement(this, this._hass.themes, this._config.theme);
    }
  }


  static get styles(): CSSResultGroup {
    return css`
      ha-card {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .card-header {
        display: flex;
        justify-content: space-between;
      }

      .card-header .name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #states {
        flex: 1;
      }

      #states > * {
        margin: 8px 0;
      }

      #states > *:first-child {
        margin-top: 0;
      }

      #states > *:last-child {
        margin-bottom: 0;
      }

      #states > div > * {
        overflow: clip visible;
      }

      #states > div {
        position: relative;
      }

      .icon {
        padding: 0px 18px 0px 8px;
      }

      .header {
        border-top-left-radius: var(--ha-card-border-radius, 12px);
        border-top-right-radius: var(--ha-card-border-radius, 12px);
        margin-bottom: 16px;
        overflow: hidden;
      }

      .footer {
        border-bottom-left-radius: var(--ha-card-border-radius, 12px);
        border-bottom-right-radius: var(--ha-card-border-radius, 12px);
        margin-top: -16px;
        overflow: hidden;
      }
    `;
  }

  private _renderEntity(entityConf: LovelaceRowConfig): TemplateResult {
    const element = createRowElement(
      (!("type" in entityConf) || entityConf.type === "conditional") &&
        "state_color" in this._config!
        ? ({
            state_color: this._config.state_color,
            ...(entityConf as EntityConfig),
          } as EntityConfig)
        : entityConf.type === "perform-action"
          ? { ...entityConf, type: "call-service" }
          : entityConf
    );
    if (this._hass) {
      element.hass = this._hass;
    }

    return html`<div>${element}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-entities-card": HuiEntitiesCard;
  }
}
