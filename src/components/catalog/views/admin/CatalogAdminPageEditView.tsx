import { FC, useEffect, useState } from 'react';
import { FaLanguage, FaSave, FaSpinner, FaTrash } from 'react-icons/fa';
import { CatalogType, LocalizeText, localizeWithFallback } from '../../../../api';
import { useCatalogData, useCatalogUiState, useTranslationActions, useTranslationState } from '../../../../hooks';
import { CATALOG_ROOT_LOCK_ID, IEditingPageDetails, IPageEditData, useCatalogAdmin } from '../../CatalogAdminContext';
import { parseCatalogTabLabel } from '../../useCatalogWindowWidth';
import { CatalogIconView } from '../catalog-icon/CatalogIconView';
import { CatalogAdminModalView } from './CatalogAdminModalView';

const LAYOUT_OPTIONS = [
    'default_3x3',
    'club_buy',
    'club_gift',
    'frontpage',
    'pets',
    'pets2',
    'pets3',
    'spaces_new',
    'spaces',
    'soundmachine',
    'trophies',
    'roomads',
    'guilds',
    'guild_forum',
    'guild_furni',
    'vip_buy',
    'builders_club_frontpage',
    'builders_club_addons',
    'builders_club_loyalty',
    'marketplace',
    'marketplace_own_items',
    'recycler',
    'recycler_info',
    'recycler_prizes',
    'info_loyalty',
    'info_duckets',
    'info_rentables',
    'info_pets',
    'loyalty_vip_buy',
    'badge_display',
    'bots',
    'single_bundle',
    'sold_ltd_items',
    'plasto',
    'default_3x3_color_grouping',
    'recent_purchases',
    'room_bundle',
    'petcustomization',
    'frontpage_featured',
    'root',
    'monkey',
    'niko',
    'mad_money',
    'custom_prefix',
    'productpage1',
    'collectibles'
];

const MODE_OPTIONS = [
    { value: 'NORMAL', label: 'Normal' },
    { value: 'BUILDER', label: 'Builder' },
    { value: 'BOTH', label: 'Both' }
];

export const resolveCatalogAdminPageDisplayName = (
    formCaption: string,
    detailsCaption: string | undefined,
    nodeLocalization: string,
    nodePageName: string,
    fallback: string
) =>
    formCaption?.trim() ||
    detailsCaption?.trim() ||
    parseCatalogTabLabel(nodeLocalization).name ||
    nodePageName?.trim() ||
    fallback;

export const resolveCatalogAdminPageInteraction = (
    sessionReady: boolean,
    detailsReady: boolean,
    lockReady: boolean,
    loading: boolean,
    error: string | null
) => {
    if (error) return { canSave: false, message: error };
    if (!sessionReady) return { canSave: false, message: 'Connecting to Catalog Studio...' };
    if (!detailsReady) return { canSave: false, message: 'Loading page details...' };
    if (!lockReady) return { canSave: false, message: 'Waiting for the edit lock...' };
    if (loading) return { canSave: false, message: 'Saving page...' };
    return { canSave: true, message: null };
};

export const createCatalogAdminPageFormState = (details: IEditingPageDetails): IPageEditData => ({
    pageId: details.pageId,
    caption: details.caption,
    captionSave: details.captionSave,
    parentId: details.parentId,
    catalogMode: details.catalogMode,
    pageLayout: details.layout,
    iconColor: details.iconColor,
    iconImage: details.iconImage,
    minRank: details.minRank,
    orderNum: details.orderNum,
    visible: details.visible ? '1' : '0',
    enabled: details.enabled ? '1' : '0',
    clubOnly: details.clubOnly ? '1' : '0',
    vipOnly: details.vipOnly ? '1' : '0',
    pageHeadline: details.headline,
    pageTeaser: details.teaser,
    pageSpecial: details.special,
    pageText1: details.textOne,
    pageText2: details.textTwo,
    pageTextDetails: details.textDetails,
    pageTextTeaser: details.textTeaser,
    roomId: details.roomId,
    includes: details.includes
});

export const createCatalogAdminNewPageFormState = (parentId: number, catalogMode: string): IPageEditData => ({
    pageId: undefined,
    caption: '',
    captionSave: '',
    parentId,
    catalogMode,
    pageLayout: 'default_3x3',
    iconColor: 1,
    iconImage: 0,
    minRank: 1,
    orderNum: 0,
    visible: '1',
    enabled: '1'
});

export const validateCatalogAdminPageForm = (data: IPageEditData): string | null => {
    if (!data.caption.trim()) return 'Page caption is required.';
    if (!LAYOUT_OPTIONS.includes(data.pageLayout)) return 'Select a valid page layout.';
    if (data.minRank < 1) return 'Minimum rank must be at least 1.';
    if (data.iconImage < 0 || data.iconColor < 0) return 'Icon values cannot be negative.';
    if (data.orderNum < 0) return 'Order cannot be negative.';
    if (data.parentId < -1) return 'Parent page ID is invalid.';
    if ((data.roomId || 0) < 0) return 'Room ID cannot be negative.';

    const includes = (data.includes || '').replace(/\s+/g, '');
    if (includes && includes.split(/[;,]/).some((id) => !/^[1-9]\d*$/.test(id))) {
        return 'Included page IDs must be positive numbers separated by semicolons.';
    }
    return null;
};

export const CatalogAdminPageEditView: FC<{}> = () => {
    const { currentPage = null, rootNode = null } = useCatalogData();
    const { activeNodes = [], currentType = CatalogType.NORMAL } = useCatalogUiState();
    const catalogAdmin = useCatalogAdmin();
    const editingPageData = catalogAdmin?.editingPageData ?? false;
    const editingRootPage = catalogAdmin?.editingRootPage ?? false;
    const editingPageNode = catalogAdmin?.editingPageNode ?? null;
    const editingPageDetails = catalogAdmin?.editingPageDetails ?? null;
    const creatingPage = catalogAdmin?.creatingPage ?? false;
    const requestPageDetails = catalogAdmin?.requestPageDetails;
    const loading = catalogAdmin?.loading ?? false;
    const lastError = catalogAdmin?.lastError ?? null;
    const studioSessionReady = catalogAdmin?.studioSessionReady ?? false;
    const ensurePageLock = catalogAdmin?.ensurePageLock;
    const hasPageLock = catalogAdmin?.hasPageLock;

    const [caption, setCaption] = useState('');
    const [captionSave, setCaptionSave] = useState('');
    const [catalogMode, setCatalogMode] = useState<string>('NORMAL');
    const [pageLayout, setPageLayout] = useState('default_3x3');
    const [iconColor, setIconColor] = useState(1);
    const [iconImage, setIconImage] = useState(0);
    const [minRank, setMinRank] = useState(1);
    const [visible, setVisible] = useState('1');
    const [enabled, setEnabled] = useState('1');
    const [orderNum, setOrderNum] = useState(0);
    const [parentId, setParentId] = useState(-1);
    const [clubOnly, setClubOnly] = useState('0');
    const [vipOnly, setVipOnly] = useState('0');
    const [pageHeadline, setPageHeadline] = useState('');
    const [pageTeaser, setPageTeaser] = useState('');
    const [pageSpecial, setPageSpecial] = useState('');
    const [pageText1, setPageText1] = useState('');
    const [pageText2, setPageText2] = useState('');
    const [pageTextDetails, setPageTextDetails] = useState('');
    const [pageTextTeaser, setPageTextTeaser] = useState('');
    const [roomId, setRoomId] = useState(0);
    const [includes, setIncludes] = useState('');
    const [showTranslate, setShowTranslate] = useState(false);
    const [translateTargetLanguage, setTranslateTargetLanguage] = useState('en');
    const [isTranslating, setIsTranslating] = useState(false);
    const [translateError, setTranslateError] = useState<string | null>(null);
    const { supportedLanguages = [], languagesLoading = false } = useTranslationState();
    const { translateText, ensureSupportedLanguagesLoaded } = useTranslationActions();
    const targetNode = editingPageNode ? editingPageNode : editingRootPage ? rootNode : activeNodes.length > 0 ? activeNodes[activeNodes.length - 1] : null;

    const targetPageId = targetNode?.pageId ?? currentPage?.pageId;
    const isRoot = editingRootPage;
    const lockPageId = creatingPage
        ? targetNode && targetNode.pageId > 0 ? targetNode.pageId : CATALOG_ROOT_LOCK_ID
        : targetPageId;

    const closeForm = () => {
        catalogAdmin?.setEditingPageData(false);
        catalogAdmin?.setEditingRootPage(false);
        catalogAdmin?.setEditingPageNode(null);
        catalogAdmin?.setCreatingPage(false);
    };

    useEffect(() => {
        if (!editingPageData || !targetNode) return;

        if (creatingPage) {
            const mode = currentType === CatalogType.BUILDER ? 'BUILDER' : 'NORMAL';
            const form = createCatalogAdminNewPageFormState(targetNode.pageId, mode);
            setCaption(form.caption);
            setCaptionSave(form.captionSave);
            setCatalogMode(form.catalogMode);
            setPageLayout(form.pageLayout);
            setIconColor(form.iconColor);
            setIconImage(form.iconImage);
            setMinRank(form.minRank);
            setOrderNum(form.orderNum);
            setParentId(form.parentId);
            setVisible(form.visible);
            setEnabled(form.enabled);
            setClubOnly(form.clubOnly || '0');
            setVipOnly(form.vipOnly || '0');
            setPageHeadline('');
            setPageTeaser('');
            setPageSpecial('');
            setPageText1('');
            setPageText2('');
            setPageTextDetails('');
            setPageTextTeaser('');
            setRoomId(0);
            setIncludes('');
            setShowTranslate(false);
            setIsTranslating(false);
            setTranslateError(null);
            return;
        }

        setCaption('');
        setCaptionSave('');
        setMinRank(1);
        setOrderNum(0);
        setEnabled('1');

        setCatalogMode(currentType === CatalogType.BUILDER ? 'BUILDER' : 'NORMAL');
        setPageLayout('default_3x3');
        setIconImage(targetNode.iconId ?? 0);
        setVisible(targetNode.isVisible ? '1' : '0');

        setPageText1('');
        setShowTranslate(false);
        setIsTranslating(false);
        setTranslateError(null);
        const wireParentId = targetNode.parentId;
        setParentId(typeof wireParentId === 'number' && wireParentId !== -1 ? wireParentId : targetNode.parent ? targetNode.parent.pageId : -1);

        if (targetPageId != null && targetPageId >= 0) requestPageDetails?.(targetPageId);
    }, [editingPageData, creatingPage, targetNode, currentPage, currentType, targetPageId, requestPageDetails]);

    useEffect(() => {
        if (!editingPageData || lockPageId == null || lockPageId < 0) return;
        ensurePageLock?.(lockPageId);
    }, [editingPageData, lockPageId, ensurePageLock]);

    useEffect(() => {
        if (!editingPageDetails) return;
        if (targetPageId != null && editingPageDetails.pageId !== targetPageId) return;

        const form = createCatalogAdminPageFormState(editingPageDetails);
        setCaption(form.caption);
        setCaptionSave(form.captionSave);
        setCatalogMode(form.catalogMode);
        setPageLayout(form.pageLayout);
        setIconColor(form.iconColor);
        setIconImage(form.iconImage);
        setMinRank(form.minRank);
        setOrderNum(form.orderNum);
        setParentId(form.parentId);
        setVisible(form.visible);
        setEnabled(form.enabled);
        setClubOnly(form.clubOnly || '0');
        setVipOnly(form.vipOnly || '0');
        setPageHeadline(form.pageHeadline || '');
        setPageTeaser(form.pageTeaser || '');
        setPageSpecial(form.pageSpecial || '');
        setPageText1(form.pageText1 || '');
        setPageText2(form.pageText2 || '');
        setPageTextDetails(form.pageTextDetails || '');
        setPageTextTeaser(form.pageTextTeaser || '');
        setRoomId(form.roomId || 0);
        setIncludes(form.includes || '');
    }, [editingPageDetails, targetPageId]);

    if (!editingPageData || !targetNode) return null;

    const inputClass = 'nitro-catalog-admin-input';
    const previewName = resolveCatalogAdminPageDisplayName(
        caption,
        editingPageDetails?.caption,
        targetNode.localization,
        targetNode.pageName,
        localizeWithFallback('catalog.admin.page.untitled', 'Untitled page')
    );
    const detailsReady = creatingPage || editingPageDetails?.pageId === targetPageId;
    const lockReady = lockPageId != null && lockPageId >= 0 && (hasPageLock?.(lockPageId) ?? false);
    const interaction = resolveCatalogAdminPageInteraction(studioSessionReady, detailsReady, lockReady, loading, lastError);
    const formData: IPageEditData = {
        pageId: creatingPage ? undefined : targetPageId,
        caption,
        captionSave,
        catalogMode,
        pageLayout,
        iconColor,
        iconImage,
        minRank,
        visible,
        enabled,
        orderNum,
        parentId,
        clubOnly,
        vipOnly,
        pageHeadline,
        pageTeaser,
        pageSpecial,
        pageText1,
        pageText2,
        pageTextDetails,
        pageTextTeaser,
        roomId,
        includes
    };
    const validationError = detailsReady ? validateCatalogAdminPageForm(formData) : null;

    const handleSave = async () => {
        if (!catalogAdmin?.savePage || !catalogAdmin.createPage || !interaction.canSave) return;
        if (validationError) return;

        if (creatingPage) catalogAdmin.createPage(formData);
        else catalogAdmin.savePage(formData);
    };

    const openTranslate = () => {
        const next = !showTranslate;
        setShowTranslate(next);
        setTranslateError(null);
        if (next) ensureSupportedLanguagesLoaded();
    };

    const runTranslate = async () => {
        if (!pageText1.trim().length) {
            setTranslateError(localizeWithFallback('catalog.admin.translate.empty', 'Nothing to translate yet.'));
            return;
        }

        if (!translateTargetLanguage) {
            setTranslateError(localizeWithFallback('catalog.admin.translate.pick.language', 'Pick a language first.'));
            return;
        }

        setIsTranslating(true);
        setTranslateError(null);

        try {
            const result = await translateText(pageText1, translateTargetLanguage);
            setPageText1(result?.translatedText || pageText1);
            setShowTranslate(false);
        } catch (error) {
            setTranslateError((error as Error)?.message || localizeWithFallback('catalog.admin.translate.failed', 'Translation failed.'));
        } finally {
            setIsTranslating(false);
        }
    };

    const handleDelete = async () => {
        if (!catalogAdmin?.deletePage || isRoot || creatingPage) return;
        if (!confirm(LocalizeText('catalog.admin.delete.page.confirm', ['name'], [editingPageDetails?.caption ?? '']))) return;

        catalogAdmin.deletePage(targetPageId);
        closeForm();
    };

    return (
        <CatalogAdminModalView
            title={
                creatingPage
                    ? localizeWithFallback('catalog.admin.create.page', 'Create page')
                    : isRoot
                      ? LocalizeText('catalog.admin.edit.root')
                      : localizeWithFallback('catalog.admin.edit.page', 'Edit page')
            }
            widthClassName="w-[540px]"
            onClose={closeForm}
        >
            <div className="nitro-catalog-admin-form">
                <div className="nitro-catalog-admin-form-sheet">
                    <div className="nitro-catalog-admin-form-scroll">
                        <div className="nitro-catalog-admin-form-hero">
                            <span className="nitro-catalog-admin-page-preview-icon">{iconImage > 0 ? <CatalogIconView icon={iconImage} /> : null}</span>
                            <div className="nitro-catalog-admin-page-preview-info">
                                <span className="nitro-catalog-admin-page-preview-name" title={previewName}>
                                    {previewName}
                                </span>
                                <span className="nitro-catalog-admin-page-preview-sub">
                                    {localizeWithFallback('catalog.admin.page.id', 'Page ID')} {targetPageId ?? '—'} · {pageLayout} · {catalogMode}
                                </span>
                            </div>
                        </div>

                        <section className="nitro-catalog-admin-form-section">
                            <div className="nitro-catalog-admin-section-title">{localizeWithFallback('catalog.admin.page.section.identity', 'Identity')}</div>
                            <div className="nitro-catalog-admin-form-grid is-2col">
                                <div className="nitro-catalog-admin-form-field is-span-2">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.caption', 'Caption')}
                                    </label>
                                    <input className={inputClass} value={caption} onChange={(e) => setCaption(e.target.value)} />
                                </div>
                                <div className="nitro-catalog-admin-form-field is-span-2">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.caption.save', 'Localisation key')}
                                    </label>
                                    <input className={inputClass} value={captionSave} onChange={(e) => setCaptionSave(e.target.value)} />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.min.rank', 'Min rank')}
                                    </label>
                                    <input
                                        className={inputClass}
                                        min={1}
                                        type="number"
                                        value={minRank}
                                        onChange={(e) => setMinRank(parseInt(e.target.value) || 1)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.icon.image', 'Icon image')}
                                    </label>
                                    <input
                                        className={inputClass}
                                        min={0}
                                        type="number"
                                        value={iconImage}
                                        onChange={(e) => setIconImage(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.icon.color', 'Icon color')}
                                    </label>
                                    <input
                                        className={inputClass}
                                        min={0}
                                        type="number"
                                        value={iconColor}
                                        onChange={(e) => setIconColor(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="nitro-catalog-admin-form-section">
                            <div className="nitro-catalog-admin-section-title">{localizeWithFallback('catalog.admin.page.section.display', 'Display')}</div>
                            <div className="nitro-catalog-admin-form-grid is-3col">
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{localizeWithFallback('catalog.admin.page.mode', 'Mode')}</label>
                                    <select className={inputClass} value={catalogMode} onChange={(e) => setCatalogMode(e.target.value)}>
                                        {MODE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{localizeWithFallback('catalog.admin.page.layout', 'Layout')}</label>
                                    <select className={inputClass} value={pageLayout} onChange={(e) => setPageLayout(e.target.value)}>
                                        {LAYOUT_OPTIONS.map((l) => (
                                            <option key={l} value={l}>
                                                {l}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">{LocalizeText('catalog.admin.order')}</label>
                                    <input
                                        className={inputClass}
                                        min={0}
                                        type="number"
                                        value={orderNum}
                                        onChange={(e) => setOrderNum(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.parent.id', 'Parent ID')}
                                    </label>
                                    <input
                                        className={inputClass}
                                        disabled={isRoot}
                                        type="number"
                                        value={parentId}
                                        onChange={(e) => setParentId(parseInt(e.target.value) || -1)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field is-span-2">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.visibility', 'Visibility')}
                                    </label>
                                    <div className="nitro-catalog-admin-form-toggles">
                                        <label className="nitro-catalog-admin-form-toggle">
                                            <input checked={visible === '1'} type="checkbox" onChange={(e) => setVisible(e.target.checked ? '1' : '0')} />
                                            {LocalizeText('catalog.admin.visible')}
                                        </label>
                                        <label className="nitro-catalog-admin-form-toggle">
                                            <input checked={enabled === '1'} type="checkbox" onChange={(e) => setEnabled(e.target.checked ? '1' : '0')} />
                                            {LocalizeText('catalog.admin.enabled')}
                                        </label>
                                        <label className="nitro-catalog-admin-form-toggle">
                                            <input checked={clubOnly === '1'} type="checkbox" onChange={(e) => setClubOnly(e.target.checked ? '1' : '0')} />
                                            {localizeWithFallback('catalog.admin.page.club.only', 'HC only')}
                                        </label>
                                        <label className="nitro-catalog-admin-form-toggle">
                                            <input checked={vipOnly === '1'} type="checkbox" onChange={(e) => setVipOnly(e.target.checked ? '1' : '0')} />
                                            {localizeWithFallback('catalog.admin.page.vip.only', 'VIP only')}
                                        </label>
                                    </div>
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.room.id', 'Room ID')}
                                    </label>
                                    <input
                                        className={inputClass}
                                        min={0}
                                        type="number"
                                        value={roomId}
                                        onChange={(e) => setRoomId(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.includes', 'Included page IDs')}
                                    </label>
                                    <input className={inputClass} placeholder="1;2;3" value={includes} onChange={(e) => setIncludes(e.target.value)} />
                                </div>
                            </div>
                        </section>

                        <section className="nitro-catalog-admin-form-section">
                            <div className="nitro-catalog-admin-section-title">{localizeWithFallback('catalog.admin.page.section.content', 'Content')}</div>
                            <div className="nitro-catalog-admin-form-grid is-2col">
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.headline', 'Headline image')}
                                    </label>
                                    <input className={inputClass} value={pageHeadline} onChange={(e) => setPageHeadline(e.target.value)} />
                                </div>
                                <div className="nitro-catalog-admin-form-field">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.teaser', 'Teaser image')}
                                    </label>
                                    <input className={inputClass} value={pageTeaser} onChange={(e) => setPageTeaser(e.target.value)} />
                                </div>
                                <div className="nitro-catalog-admin-form-field is-span-2">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.special', 'Special image')}
                                    </label>
                                    <input className={inputClass} value={pageSpecial} onChange={(e) => setPageSpecial(e.target.value)} />
                                </div>
                            </div>
                            <div className="nitro-catalog-admin-form-field">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="nitro-catalog-admin-label is-field">
                                        {localizeWithFallback('catalog.admin.page.text.1', 'Page text')}
                                    </label>
                                    <button
                                        className="nitro-catalog-admin-button is-ghost is-compact"
                                        disabled={isTranslating || !pageText1.trim().length}
                                        title={localizeWithFallback('catalog.admin.translate.title', 'Translate via Google Translate')}
                                        type="button"
                                        onClick={openTranslate}
                                    >
                                        {isTranslating ? <FaSpinner className="text-[8px] animate-spin" /> : <FaLanguage className="text-[10px]" />}
                                        {localizeWithFallback('catalog.admin.translate.action', 'Translate')}
                                    </button>
                                </div>
                                {showTranslate && (
                                    <div className="nitro-catalog-admin-translate-bar">
                                        <select
                                            className={`${inputClass} flex-1 min-w-[120px]`}
                                            disabled={isTranslating || languagesLoading}
                                            value={translateTargetLanguage}
                                            onChange={(e) => setTranslateTargetLanguage(e.target.value)}
                                        >
                                            {languagesLoading && !supportedLanguages.length && (
                                                <option value="">
                                                    {localizeWithFallback('catalog.admin.translate.loading.languages', 'Loading languages...')}
                                                </option>
                                            )}
                                            {supportedLanguages.map((lang) => (
                                                <option key={lang.code} value={lang.code}>
                                                    {lang.name} ({lang.code})
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            className="nitro-catalog-admin-button is-primary"
                                            disabled={isTranslating || !translateTargetLanguage || !pageText1.trim().length}
                                            type="button"
                                            onClick={runTranslate}
                                        >
                                            {isTranslating ? (
                                                <FaSpinner className="text-[8px] animate-spin" />
                                            ) : (
                                                localizeWithFallback('catalog.admin.translate.apply', 'Apply')
                                            )}
                                        </button>
                                        <button
                                            className="nitro-catalog-admin-button is-muted"
                                            disabled={isTranslating}
                                            type="button"
                                            onClick={() => {
                                                setShowTranslate(false);
                                                setTranslateError(null);
                                            }}
                                        >
                                            {localizeWithFallback('catalog.admin.cancel', 'Cancel')}
                                        </button>
                                    </div>
                                )}
                                {translateError && <span className="nitro-catalog-admin-translate-error">{translateError}</span>}
                                <textarea className={`${inputClass} min-h-[80px] resize-y`} value={pageText1} onChange={(e) => setPageText1(e.target.value)} />
                            </div>
                            <div className="nitro-catalog-admin-form-field">
                                <label className="nitro-catalog-admin-label is-field">
                                    {localizeWithFallback('catalog.admin.page.text.2', 'Secondary text')}
                                </label>
                                <textarea className={`${inputClass} min-h-[70px] resize-y`} value={pageText2} onChange={(e) => setPageText2(e.target.value)} />
                            </div>
                            <div className="nitro-catalog-admin-form-field">
                                <label className="nitro-catalog-admin-label is-field">
                                    {localizeWithFallback('catalog.admin.page.text.details', 'Details text')}
                                </label>
                                <textarea
                                    className={`${inputClass} min-h-[70px] resize-y`}
                                    value={pageTextDetails}
                                    onChange={(e) => setPageTextDetails(e.target.value)}
                                />
                            </div>
                            <div className="nitro-catalog-admin-form-field">
                                <label className="nitro-catalog-admin-label is-field">
                                    {localizeWithFallback('catalog.admin.page.text.teaser', 'Teaser text')}
                                </label>
                                <textarea
                                    className={`${inputClass} min-h-[70px] resize-y`}
                                    value={pageTextTeaser}
                                    onChange={(e) => setPageTextTeaser(e.target.value)}
                                />
                            </div>
                        </section>
                    </div>

                    <div className="nitro-catalog-admin-form-actions">
                        {(validationError || lastError) && (
                            <span className="nitro-catalog-admin-translate-error">{validationError || lastError}</span>
                        )}
                        {!validationError && !lastError && interaction.message && (
                            <span className="nitro-catalog-admin-form-status">{interaction.message}</span>
                        )}
                        {!isRoot && !creatingPage ? (
                            <button className="nitro-catalog-admin-button is-danger" onClick={handleDelete}>
                                <FaTrash className="text-[8px]" /> {LocalizeText('catalog.admin.delete')}
                            </button>
                        ) : (
                            <div />
                        )}
                        <button className="nitro-catalog-admin-button is-primary" disabled={!interaction.canSave || !!validationError} onClick={handleSave}>
                            {loading ? <FaSpinner className="text-[8px] animate-spin" /> : <FaSave className="text-[8px]" />}{' '}
                            {creatingPage ? LocalizeText('catalog.admin.create') : LocalizeText('catalog.admin.save')}
                        </button>
                    </div>
                </div>
            </div>
        </CatalogAdminModalView>
    );
};
