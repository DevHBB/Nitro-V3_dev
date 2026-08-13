import { FC } from 'react';
import { LocalizeText, SearchFilterOptions } from '../../../../api';

interface NavigatorFilterChipsViewProps {
    value: number;
    onChange: (index: number) => void;
}

export const NavigatorFilterChipsView: FC<NavigatorFilterChipsViewProps> = (props) => {
    const { value, onChange } = props;

    return (
        <select
            className="nitro-navigator-air__filter form-select form-select-sm"
            aria-label={LocalizeText('navigator.filter.anything')}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
        >
            {SearchFilterOptions.map((filter, index) => {
                return (
                    <option key={index} value={index}>
                        {LocalizeText('navigator.filter.' + filter.name)}
                    </option>
                );
            })}
        </select>
    );
};
