/**
 * Model/Data Method Browser Component
 */
import * as React from 'react';
import { IModel, IDataMethod } from '../types';

interface IProps {
  items: (IModel | IDataMethod)[];
  loading: boolean;
  onSelect: (item: IModel | IDataMethod) => void;
  type: 'model' | 'datamethod';
}

export const ModelBrowser: React.FC<IProps> = ({ items, loading, onSelect, type }) => {
  if (loading) {
    return (
      <div className="geomodel-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="geomodel-empty">
        <p>No {type === 'model' ? 'models' : 'data methods'} found</p>
      </div>
    );
  }

  return (
    <div className="geomodel-list">
      {items.map((item) => (
        <div 
          key={item.id} 
          className="geomodel-item"
          onClick={() => onSelect(item)}
        >
          <div className="item-icon">
            {type === 'model' ? 'M' : 'D'}
          </div>
          <div className="item-info">
            <h4 className="item-name">{item.name}</h4>
            <p className="item-desc">
              {item.description || 'No description available'}
            </p>
            <span className="item-author">{item.author || 'OpenGeoLab'}</span>
          </div>
          <div className="item-arrow">›</div>
        </div>
      ))}
    </div>
  );
};
