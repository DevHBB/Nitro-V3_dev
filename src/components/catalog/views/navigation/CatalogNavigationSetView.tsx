import { FC } from 'react';
import { ICatalogNode } from '../../../../api';
import { CatalogNavigationItemView } from './CatalogNavigationItemView';
import { CatalogNavigationRuntime } from './CatalogNavigationRuntime';

export interface CatalogNavigationSetViewProps {
    node: ICatalogNode;
    runtime: CatalogNavigationRuntime;
    child?: boolean;
}

export const CatalogNavigationSetView: FC<CatalogNavigationSetViewProps> = (props) => {
    const { node = null, runtime, child = false } = props;

    return (
        <>
            {node &&
                node.children.length > 0 &&
                node.children.map((n) => {
                    if (!n.isVisible) return null;

                    return <CatalogNavigationItemView key={n.pageId} child={child} node={n} runtime={runtime} />;
                })}
        </>
    );
};
