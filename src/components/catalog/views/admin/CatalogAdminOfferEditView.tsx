import { FC, useEffect, useRef, useState } from 'react';
import { FaCubes, FaSave, FaSpinner, FaTrash } from 'react-icons/fa';
import { CatalogType, GetConfigurationValue, IPurchasableOffer, LocalizeText, localizeWithFallback, ProductTypeEnum } from '../../../../api';
import { useCatalogData, useCatalogUiState, usePurse } from '../../../../hooks';
import { IEditingOfferDetails, IOfferEditData, useCatalogAdmin } from '../../CatalogAdminContext';
import { CatalogAdminModalView } from './CatalogAdminModalView';
import { CatalogAdminOfferPriceView } from './CatalogAdminOfferPriceView';
import { useCatalogStudio } from '../../admin/studio/useCatalogStudio';
import { claimCatalogAdminHydration } from './CatalogAdminFormHydration';

const getOfferIconUrl = (offer: IPurchasableOffer | null): string | null => {
    const product = offer?.product;
    if (!product) return null;

    if (product.productType === ProductTypeEnum.FLOOR || product.productType === ProductTypeEnum.WALL) {
        const className = product.furnitureData?.className;

        if (className?.length) {
            let param = '';

            if (product.productType === ProductTypeEnum.WALL && product.extraParam?.length) {
                param = `_${product.extraParam}`;
            } else if (product.productType === ProductTypeEnum.FLOOR && product.furnitureData?.hasIndexedColor && product.furnitureData.colorIndex > 0) {
                param = `_${product.furnitureData.colorIndex}`;
            }

            const configuredIconUrl = GetConfigurationValue<string>('furni.asset.icon.url', '');
            if (configuredIconUrl?.length) return configuredIconUrl.replace('%libname%', className).replace('%param%', param);
        }
    }

    return product.getIconUrl(offer) ?? null;
};

export const createCatalogAdminOfferFormState = (details: IEditingOfferDetails): IOfferEditData => ({
    offerId: details.offerId,
    pageId: details.pageId,
    itemIds: details.itemIds,
    catalogName: details.catalogName,
    costCredits: details.costCredits,
    costPoints: details.costPoints,
    pointsType: details.pointsType,
    amount: details.amount,
    clubOnly: details.clubOnly ? '1' : '0',
    extradata: details.extradata,
    haveOffer: details.haveOffer ? '1' : '0',
    offerId_group: details.offerIdGroup,
    songId: details.songId,
    limitedStack: details.limitedStack,
    orderNumber: details.orderNumber
});

export const createCatalogAdminNewOfferFormState = (pageId: number, orderNumber = 0): IOfferEditData => ({
    pageId,
    itemIds: '',
    catalogName: '',
    costCredits: 0,
    costPoints: 0,
    pointsType: 0,
    amount: 1,
    clubOnly: '0',
    extradata: '',
    haveOffer: '1',
    offerId_group: -1,
    songId: 0,
    limitedStack: 0,
    orderNumber
});

export const validateCatalogAdminOfferForm = (data: IOfferEditData, builderCatalog: boolean, limitedSells: number): string | null => {
    if (data.pageId <= 0) return 'Select a valid catalog page.';
    if (!data.catalogName.trim()) return 'Offer name is required.';

    const cleanItemIds = data.itemIds.replace(/\s+/g, '');
    if (!builderCatalog && !cleanItemIds) return 'Item IDs are required.';
    if (cleanItemIds) {
        const entries = cleanItemIds.split(/[;,]/);
        if (entries.some((entry) => !/^\d+(?::[1-9]\d*)?$/.test(entry) || Number(entry.split(':')[0]) <= 0)) {
            return 'Item IDs must use the format 123 or 123:2, separated by semicolons.';
        }
    }

    if (data.costCredits < 0 || data.costPoints < 0 || data.pointsType < 0) return 'Prices and currency type cannot be negative.';
    if (data.amount < 1 || data.amount > 10000) return 'Quantity must be between 1 and 10,000.';
    if (data.songId < 0) return 'Song ID cannot be negative.';
    if (data.limitedStack < limitedSells) return 'Limited stack cannot be lower than the number already sold.';
    return null;
};

export const resolveCatalogAdminOfferInteraction = (
    sessionReady: boolean,
    detailsReady: boolean,
    loading: boolean,
    error: string | null
) => {
    if (error) return { canSave: false, message: error };
    if (!sessionReady) return { canSave: false, message: 'Connecting to Catalog Studio...' };
    if (!detailsReady) return { canSave: false, message: 'Loading offer details...' };
    if (loading) return { canSave: false, message: 'Saving offer...' };
    return { canSave: true, message: null };
};

export const CatalogAdminOfferEditView: FC<{}> = () => {
    const { currentPage = null } = useCatalogData();
    const { currentType } = useCatalogUiState();
    const { purse } = usePurse();
    const catalogAdmin = useCatalogAdmin();
    const studio = useCatalogStudio();
    const editingOffer = catalogAdmin?.editingOffer ?? null;
    const editingOfferDetails = catalogAdmin?.editingOfferDetails ?? null;
    const setEditingOffer = catalogAdmin?.setEditingOffer;
    const saveOffer = catalogAdmin?.saveOffer;
    const deleteOffer = catalogAdmin?.deleteOffer;
    const createOffer = catalogAdmin?.createOffer;
    const loading = catalogAdmin?.loading ?? false;
    const lastError = catalogAdmin?.lastError ?? null;
    const studioSessionReady = catalogAdmin?.studioSessionReady ?? false;

    const [itemIds, setItemIds] = useState('');
    const [catalogName, setCatalogName] = useState('');
    const [costCredits, setCostCredits] = useState(0);
    const [costPoints, setCostPoints] = useState(0);
    const [pointsType, setPointsType] = useState(0);
    const [amount, setAmount] = useState(1);
    const [clubOnly, setClubOnly] = useState('0');
    const [extradata, setExtradata] = useState('');
    const [haveOffer, setHaveOffer] = useState('1');
    const [offerId, setOfferIdGroup] = useState(-1);
    const [songId, setSongId] = useState(0);
    const [limitedStack, setLimitedStack] = useState(0);
    const [orderNumber, setOrderNumber] = useState(0);
    const [isNew, setIsNew] = useState(false);
    const initializationClaimRef = useRef({ current: null as string | null });
    const detailsClaimRef = useRef({ current: null as string | null });
    const formTargetKey = editingOffer
        ? `offer:${currentType}:${editingOffer.offerId}:${editingOffer.offerId === -1 ? currentPage?.pageId || 0 : editingOffer.offerId}`
        : null;

    useEffect(() => {
        if (!editingOffer) {
            claimCatalogAdminHydration(initializationClaimRef.current, null);
            claimCatalogAdminHydration(detailsClaimRef.current, null);
            setIsNew(false);
            return;
        }

        if (editingOffer.offerId === -1 && !studio.session) return;
        if (!claimCatalogAdminHydration(initializationClaimRef.current, formTargetKey)) return;

        claimCatalogAdminHydration(detailsClaimRef.current, null);

        if (editingOffer.offerId === -1) {
            const pageId = currentPage?.pageId || 0;
            const catalogType = currentType === CatalogType.BUILDER ? 'BUILDER' : 'NORMAL';
            const siblingOrders = (studio.session?.offers ?? [])
                .filter((offer) => offer.catalogType === catalogType && offer.pageId === pageId)
                .map((offer) => offer.orderNumber);
            const form = createCatalogAdminNewOfferFormState(pageId, siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0);
            setIsNew(true);
            setItemIds(form.itemIds);
            setCatalogName(form.catalogName);
            setCostCredits(form.costCredits);
            setCostPoints(form.costPoints);
            setPointsType(form.pointsType);
            setAmount(form.amount);
            setClubOnly(form.clubOnly);
            setExtradata(form.extradata);
            setHaveOffer(form.haveOffer);
            setOfferIdGroup(form.offerId_group);
            setSongId(form.songId);
            setLimitedStack(form.limitedStack);
            setOrderNumber(form.orderNumber);
        } else {
            setIsNew(false);
            setItemIds(editingOffer.itemIds || '');
            setCatalogName(editingOffer.localizationName || '');
            setCostCredits(editingOffer.priceInCredits);
            setCostPoints(editingOffer.priceInActivityPoints);
            setPointsType(editingOffer.activityPointType);
            setAmount(editingOffer.product?.productCount || 1);
            setClubOnly(editingOffer.clubLevel > 0 ? '1' : '0');
            setExtradata(editingOffer.product?.extraParam || '');
            setHaveOffer(editingOffer.haveOffer ? '1' : '0');
            setOfferIdGroup(0);
            setSongId(0);
            setLimitedStack(0);
            setOrderNumber(0);
        }
    }, [editingOffer, currentPage?.pageId, currentType, formTargetKey, studio.session]);

    useEffect(() => {
        if (!editingOfferDetails) return;
        if (!editingOffer || editingOfferDetails.offerId !== editingOffer.offerId) return;
        if (!claimCatalogAdminHydration(detailsClaimRef.current, `${formTargetKey}:details`)) return;

        const form = createCatalogAdminOfferFormState(editingOfferDetails);
        setItemIds(form.itemIds);
        setCatalogName(form.catalogName);
        setCostCredits(form.costCredits);
        setCostPoints(form.costPoints);
        setPointsType(form.pointsType);
        setAmount(form.amount);
        setClubOnly(form.clubOnly);
        setExtradata(form.extradata);
        setHaveOffer(form.haveOffer);
        setOfferIdGroup(form.offerId_group);
        setSongId(form.songId);
        setLimitedStack(form.limitedStack);
        setOrderNumber(form.orderNumber);
    }, [editingOffer, editingOfferDetails, formTargetKey]);

    if (!editingOffer) return null;

    const detailsReady = isNew || editingOfferDetails?.offerId === editingOffer.offerId;
    const interaction = resolveCatalogAdminOfferInteraction(studioSessionReady, detailsReady, loading, lastError);
    const limitedSells = isNew ? 0 : editingOfferDetails?.limitedSells || 0;
    const formData: IOfferEditData = {
        offerId: isNew ? undefined : editingOffer.offerId,
        pageId: isNew ? currentPage?.pageId || 0 : editingOfferDetails?.pageId || 0,
        itemIds,
        catalogName,
        costCredits,
        costPoints,
        pointsType,
        amount,
        clubOnly,
        extradata,
        haveOffer,
        offerId_group: offerId,
        songId,
        limitedStack,
        orderNumber
    };
    const validationError = detailsReady ? validateCatalogAdminOfferForm(formData, currentType === CatalogType.BUILDER, limitedSells) : null;
    const currencyTypes = Array.from(new Set([0, 5, 101, pointsType, ...Array.from(purse?.activityPoints?.keys?.() || [])]))
        .filter((type) => type >= 0)
        .sort((left, right) => left - right);

    const handleSave = async () => {
        if (!saveOffer || !createOffer || !interaction.canSave) return;
        if (validationError) return;

        if (isNew) createOffer(formData);
        else saveOffer(formData);
    };

    const handleDelete = () => {
        if (isNew || !deleteOffer || !confirm(LocalizeText('catalog.admin.delete.offer.confirm'))) return;

        deleteOffer(editingOffer.offerId);
    };

    const inputClass = 'nitro-catalog-admin-input';
    const previewIconUrl = isNew ? null : getOfferIconUrl(editingOffer);
    const previewName =
        catalogName || editingOffer.localizationName || (isNew ? localizeWithFallback('catalog.admin.offer.new', 'New offer') : `#${editingOffer.offerId}`);
    const previewFallbackIcon = isNew ? null : editingOffer.product?.getIconUrl(editingOffer);

    return (
        <CatalogAdminModalView
            title={isNew ? LocalizeText('catalog.admin.offer.new') : localizeWithFallback('catalog.admin.edit.offer', 'Edit offer')}
            widthClassName="w-[500px]"
            onClose={() => setEditingOffer(null)}
        >
            <div className="nitro-catalog-admin-form">
                <div className="nitro-catalog-admin-form-sheet">
                    <div className="nitro-catalog-admin-form-scroll">
                        <div className="nitro-catalog-admin-form-hero">
                            <span className="nitro-catalog-admin-offer-preview-icon">
                                {previewIconUrl ? (
                                    <img
                                        alt=""
                                        draggable={false}
                                        src={previewIconUrl}
                                        onError={(event) => {
                                            if (previewFallbackIcon && event.currentTarget.src !== previewFallbackIcon)
                                                event.currentTarget.src = previewFallbackIcon;
                                            else event.currentTarget.style.visibility = 'hidden';
                                        }}
                                    />
                                ) : (
                                    <FaCubes className="nitro-catalog-admin-offer-preview-icon-empty" />
                                )}
                            </span>
                            <div className="nitro-catalog-admin-offer-preview-info">
                                <span className="nitro-catalog-admin-offer-preview-name" title={previewName}>
                                    {previewName}
                                </span>
                                <span className="nitro-catalog-admin-offer-preview-sub">
                                    {isNew
                                        ? localizeWithFallback('catalog.admin.offer.new', 'New offer')
                                        : `${localizeWithFallback('catalog.admin.offer.id', 'Offer ID')} #${editingOffer.offerId}`}
                                    {amount > 1 ? ` · x${amount}` : ''}
                                </span>
                                <span className="nitro-catalog-admin-offer-preview-price">
                                    <CatalogAdminOfferPriceView credits={costCredits} points={costPoints} pointsType={pointsType} />
                                    {costCredits <= 0 && costPoints <= 0 && <span className="is-free">{localizeWithFallback('generic.free', 'Free')}</span>}
                                </span>
                            </div>
                        </div>

                        <section className="nitro-catalog-admin-form-section">
                            <div className="nitro-catalog-admin-section-title">{localizeWithFallback('catalog.admin.offer.section.details', 'Details')}</div>
                            <div className="nitro-catalog-admin-form-field">
                                <label className="nitro-catalog-admin-label is-field">{LocalizeText('catalog.admin.offer.name')}</label>
                                <input
                                    className={inputClass}
                                    placeholder={localizeWithFallback('catalog.admin.offer.name.placeholder', 'e.g. rare_dragon_lamp')}
                                    type="text"
                                    value={catalogName}
                                    onChange={(e) => setCatalogName(e.target.value)}
                                />
                            </div>
                            <div className="nitro-catalog-admin-form-grid is-3col">
                                <div className="nitro-catalog-admin-form-field is-span-3">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.offer.item.ids', 'Item IDs')}
                                    </label>
                                    <input
                                        className={inputClass}
                                        placeholder={localizeWithFallback('catalog.admin.offer.item.ids.placeholder', '1234 or 100;200')}
                                        type="text"
                                        value={itemIds}
                                        onChange={(e) => setItemIds(e.target.value)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{LocalizeText('catalog.admin.offer.quantity')}</label>
                                    <input
                                        className={inputClass}
                                        min={1}
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{LocalizeText('catalog.admin.order')}</label>
                                    <input
                                        className={inputClass}
                                        type="number"
                                        value={orderNumber}
                                        onChange={(e) => setOrderNumber(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{localizeWithFallback('catalog.admin.offer.id', 'Offer ID')}</label>
                                    <input
                                        className={inputClass}
                                        type="number"
                                        value={offerId}
                                        onChange={(e) => setOfferIdGroup(parseInt(e.target.value) || -1)}
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="nitro-catalog-admin-form-section">
                            <div className="nitro-catalog-admin-section-title">{LocalizeText('catalog.admin.offer.prices')}</div>
                            <div className="nitro-catalog-admin-form-grid is-3col">
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{LocalizeText('catalog.admin.offer.credits')}</label>
                                    <input
                                        className={inputClass}
                                        min={0}
                                        type="number"
                                        value={costCredits}
                                        onChange={(e) => setCostCredits(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{LocalizeText('catalog.admin.offer.points')}</label>
                                    <input
                                        className={inputClass}
                                        min={0}
                                        type="number"
                                        value={costPoints}
                                        onChange={(e) => setCostPoints(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{LocalizeText('catalog.admin.offer.points.type')}</label>
                                    <select className={inputClass} value={pointsType} onChange={(e) => setPointsType(parseInt(e.target.value))}>
                                        {currencyTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {localizeWithFallback(`purse.seasonal.currency.${type}`, `Currency ${type}`)} ({type})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section className="nitro-catalog-admin-form-section">
                            <div className="nitro-catalog-admin-section-title">{LocalizeText('catalog.admin.offer.options')}</div>
                            <div className="nitro-catalog-admin-form-grid is-3col">
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{LocalizeText('catalog.admin.offer.club.only')}</label>
                                    <select className={inputClass} value={clubOnly} onChange={(e) => setClubOnly(e.target.value)}>
                                        <option value="0">{localizeWithFallback('generic.no', 'No')}</option>
                                        <option value="1">{localizeWithFallback('generic.yes', 'Yes')}</option>
                                    </select>
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.offer.limited.stack', 'Limited stack')}
                                    </label>
                                    <input
                                        className={inputClass}
                                        min={0}
                                        type="number"
                                        value={limitedStack}
                                        onChange={(e) => setLimitedStack(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                {!isNew && (
                                    <div className="nitro-catalog-admin-form-field">
                                        <label className="nitro-catalog-admin-label is-field">
                                            {localizeWithFallback('catalog.admin.offer.limited.sold', 'Already sold')}
                                        </label>
                                        <input className={inputClass} readOnly type="number" value={limitedSells} />
                                    </div>
                                )}
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{LocalizeText('catalog.admin.offer.extradata')}</label>
                                    <input
                                        className={inputClass}
                                        placeholder={LocalizeText('catalog.admin.offer.extradata')}
                                        type="text"
                                        value={extradata}
                                        onChange={(e) => setExtradata(e.target.value)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.offer.song.id', 'Song ID')}
                                    </label>
                                    <input
                                        className={inputClass}
                                        min={0}
                                        type="number"
                                        value={songId}
                                        onChange={(e) => setSongId(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <label className="nitro-catalog-admin-form-toggle">
                                <input
                                    checked={haveOffer === '1'}
                                    id="haveOffer"
                                    type="checkbox"
                                    onChange={(e) => setHaveOffer(e.target.checked ? '1' : '0')}
                                />
                                <span>{LocalizeText('catalog.admin.offer.have.offer')}</span>
                            </label>
                        </section>
                    </div>

                    <div className="nitro-catalog-admin-form-actions">
                        {(validationError || interaction.message) && (
                            <span className={validationError || lastError ? 'nitro-catalog-admin-translate-error' : 'nitro-catalog-admin-form-status'}>
                                {validationError || interaction.message}
                            </span>
                        )}
                        {!isNew ? (
                            <button className="nitro-catalog-admin-button is-danger" onClick={handleDelete}>
                                <FaTrash className="text-[8px]" /> {LocalizeText('catalog.admin.delete')}
                            </button>
                        ) : (
                            <div />
                        )}
                        <button className="nitro-catalog-admin-button is-primary" disabled={!interaction.canSave || !!validationError} onClick={handleSave}>
                            {loading ? <FaSpinner className="text-[8px] animate-spin" /> : <FaSave className="text-[8px]" />}{' '}
                            {isNew ? LocalizeText('catalog.admin.create') : LocalizeText('catalog.admin.save')}
                        </button>
                    </div>
                </div>
            </div>
        </CatalogAdminModalView>
    );
};
