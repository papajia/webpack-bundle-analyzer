/** @jsx h */
import { h, Component } from 'preact';
import filesize from 'filesize';
import { computed } from 'mobx';
import { observer } from 'mobx-preact';

import { isChunkParsed } from '../utils';
import Treemap from './Treemap';
import Tooltip from './Tooltip';
import Switcher from './Switcher';
import Sidebar from './Sidebar';
import Checkbox from './Checkbox';
import CheckboxList from './CheckboxList';
import ContextMenu from './ContextMenu';

import s from './ModulesTreemap.css';
import Search from './Search';
import { store } from '../store';
import ModulesList from './ModulesList';

const SIZE_SWITCH_ITEMS = [
  { label: 'Stat', prop: 'statSize' },
  { label: 'Parsed', prop: 'parsedSize' },
  { label: 'Gzipped', prop: 'gzipSize' }
];

@observer
export default class ModulesTreemap extends Component {
  state = {
    selectedChunk: null,
    sidebarPinned: false,
    showTooltip: false,
    tooltipContent: null
  };

  render() {
    const { selectedChunk, sidebarPinned, showTooltip, tooltipContent } = this.state;

    return (
      <div className={s.container}>
        <Sidebar pinned={sidebarPinned}
          onToggle={this.handleSidebarToggle}
          onPinStateChange={this.handleSidebarPinStateChange}
          onResize={this.handleSidebarResize}>
          <div className={s.sidebarGroup}>
            <Switcher label="Treemap sizes"
              items={this.sizeSwitchItems}
              activeItem={this.activeSizeItem}
              onSwitch={this.handleSizeSwitch} />
            {store.hasConcatenatedModules &&
              <div className={s.showOption}>
                <Checkbox checked={store.showConcatenatedModulesContent}
                  onChange={this.handleConcatenatedModulesContentToggle}>
                  {`Show content of concatenated modules${store.activeSize === 'statSize' ? '' : ' (inaccurate)'}`}
                </Checkbox>
              </div>
            }
          </div>
          <div className={s.sidebarGroup}>
            <Search label="Search modules"
              query={store.searchQuery}
              autofocus
              onQueryChange={this.handleQueryChange} />
            <div className={s.foundModulesInfo}>
              {this.foundModulesInfo}
            </div>
            {store.isSearching && store.hasFoundModules &&
              <div className={s.foundModulesContainer}>
                {store.foundModulesByChunk.map(({ chunk, modules }) =>
                  <div key={chunk.cid} className={s.foundModulesChunk}>
                    <div className={s.foundModulesChunkName}
                      onClick={() => this.treemap.zoomToGroup(chunk)}>
                      {chunk.label}
                    </div>
                    <ModulesList className={s.foundModulesList}
                      modules={modules}
                      showSize={store.activeSize}
                      highlightedText={store.searchQueryRegexp}
                      isModuleVisible={this.isModuleVisible}
                      onModuleClick={this.handleFoundModuleClick} />
                  </div>
                )}
              </div>
            }
          </div>
          {this.chunkItems.length > 1 &&
            <div className={s.sidebarGroup}>
              <CheckboxList label="Show chunks"
                items={this.chunkItems}
                checkedItems={store.selectedChunks}
                renderLabel={this.renderChunkItemLabel}
                onChange={this.handleSelectedChunksChange} />
            </div>
          }
        </Sidebar>
        <Treemap ref={this.saveTreemapRef}
          className={s.map}
          data={store.visibleChunks}
          highlightGroups={this.highlightedModules}
          weightProp={store.activeSize}
          onMouseLeave={this.handleMouseLeaveTreemap}
          onGroupHover={this.handleTreemapGroupHover}
          onGroupSecondaryClick={this.handleTreemapGroupSecondaryClick} />
        <Tooltip visible={showTooltip}>
          {tooltipContent}
        </Tooltip>
        {selectedChunk &&
          <ContextMenu visible={selectedChunk} chunk={selectedChunk} />
        }
      </div>
    );
  }

  renderModuleSize(module, sizeType) {
    const sizeProp = `${sizeType}Size`;
    const size = module[sizeProp];
    const sizeLabel = SIZE_SWITCH_ITEMS.find(item => item.prop === sizeProp).label;
    const isActive = (store.activeSize === sizeProp);

    return (typeof size === 'number') ?
      <div className={isActive ? s.activeSize : ''}>
        {sizeLabel} size: <strong>{filesize(size)}</strong>
      </div>
      :
      null;
  }

  renderChunkItemLabel = item => {
    const isAllItem = (item === CheckboxList.ALL_ITEM);
    const label = isAllItem ? 'All' : item.label;
    const size = isAllItem ? store.totalChunksSize : item[store.activeSize];

    return [
      `${label} (`,
      <strong>{filesize(size)}</strong>,
      ')'
    ];
  };

  @computed get sizeSwitchItems() {
    return store.hasParsedSizes ? SIZE_SWITCH_ITEMS : SIZE_SWITCH_ITEMS.slice(0, 1);
  }

  @computed get activeSizeItem() {
    return this.sizeSwitchItems.find(item => item.prop === store.activeSize);
  }

  @computed get chunkItems() {
    const { allChunks, activeSize } = store;
    let chunkItems = [...allChunks];

    if (activeSize !== 'statSize') {
      chunkItems = chunkItems.filter(isChunkParsed);
    }

    chunkItems.sort((chunk1, chunk2) => chunk2[activeSize] - chunk1[activeSize]);

    return chunkItems;
  }

  @computed get highlightedModules() {
    return new Set(store.foundModules);
  }

  @computed get foundModulesInfo() {
    if (!store.isSearching) {
      // `&nbsp;` to reserve space
      return '\u00A0';
    }

    if (store.hasFoundModules) {
      return ([
        <div className={s.foundModulesInfoItem}>
          Count: <strong>{store.foundModules.length}</strong>
        </div>,
        <div className={s.foundModulesInfoItem}>
          Total size: <strong>{filesize(store.foundModulesSize)}</strong>
        </div>
      ]);
    } else {
      return 'Nothing found' + (store.allChunksSelected ? '' : ' in selected chunks');
    }
  }

  handleConcatenatedModulesContentToggle = flag => {
    store.showConcatenatedModulesContent = flag;
  }

  handleSidebarToggle = () => {
    if (this.state.sidebarPinned) {
      setTimeout(() => this.treemap.resize());
    }
  }

  handleSidebarPinStateChange = pinned => {
    this.setState({ sidebarPinned: pinned });
    setTimeout(() => this.treemap.resize());
  }

  handleSidebarResize = () => {
    this.treemap.resize();
  }

  handleSizeSwitch = sizeSwitchItem => {
    store.selectedSize = sizeSwitchItem.prop;
  };

  handleQueryChange = query => {
    store.searchQuery = query;
  }

  handleSelectedChunksChange = selectedChunks => {
    store.selectedChunks = selectedChunks;
  };

  handleMouseLeaveTreemap = () => {
    this.setState({ showTooltip: false });
  };

  handleTreemapGroupSecondaryClick = event => {
    const { group } = event;
    if (group && group.parentAssetNames) {
      this.setState({
        selectedChunk: group
      });
    } else {
      this.setState({
        selectedChunk: null
      })
    }
  };

  handleTreemapGroupHover = event => {
    const { group } = event;

    if (group) {
      this.setState({
        showTooltip: true,
        tooltipContent: this.getTooltipContent(group)
      });
    } else {
      this.setState({ showTooltip: false });
    }
  };

  handleFoundModuleClick = module => this.treemap.zoomToGroup(module);

  isModuleVisible = module => (
    this.treemap.isGroupRendered(module)
  )

  saveTreemapRef = treemap => this.treemap = treemap;

  getTooltipContent(module) {
    if (!module) return null;

    return (
      <div>
        <div><strong>{module.label}</strong></div>
        <br />
        {this.renderModuleSize(module, 'stat')}
        {!module.inaccurateSizes && this.renderModuleSize(module, 'parsed')}
        {!module.inaccurateSizes && this.renderModuleSize(module, 'gzip')}
        {module.path &&
          <div>Path: <strong>{module.path}</strong></div>
        }
      </div>
    );
  }

}
