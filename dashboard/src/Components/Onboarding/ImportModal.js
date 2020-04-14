/*global neveDash*/
import {importContent, importMods, importWidgets, installPlugins} from '../../utils/site-import';
import ImportStepper from './ImportStepper';
import ImportModalNote from './ImportModalNote';
import classnames from 'classnames';
import ImportModalError from './ImportModalError';

const {withSelect, withDispatch} = wp.data;
const {compose} = wp.compose;
const {Button, Dashicon, ToggleControl, Modal} = wp.components;
const {useState, useEffect, Fragment} = wp.element;
const {__} = wp.i18n;

const ImportModal = ({setModal, setSite, editor, siteData}) => {
		const [ general, setGeneral ] = useState({
			content: true,
			customizer: true,
			widgets: true
		});
		const [ pluginsProgress, setPluginsProgress ] = useState(false);
		const [ contentProgress, setContentProgress ] = useState(false);
		const [ customizerProgress, setCustomizerProgress ] = useState(false);
		const [ widgetsProgress, setWidgetsProgress ] = useState(false);
		const [ frontPageID, setFrontPageID ] = useState(null);
		const [ currentStep, setCurrentStep ] = useState(null);
		const [ importing, setImporting ] = useState(false);
		const [ pluginOptions, setPluginOptions ] = useState({});
		const [ error, setError ] = useState(null);

		useEffect(function getPluginOptions() {
			const mandatory = {...(siteData['mandatory_plugins'] || {})};
			const optional = {...(siteData['recommended_plugins'] || {})};
			const defaultOff = siteData['default_off_recommended_plugins'] || [];

			Object.keys(mandatory).map((key) => {
				mandatory[key] = true;
			});
			Object.keys(optional).map((key) => {
				optional[key] = ! defaultOff.includes(key);
			});

			setPluginOptions({
				...optional,
				...mandatory
			});
		}, []);

		const renderNote = () => {
			console.log(siteData);
			return <ImportModalNote data={siteData}/>;
		};

		const renderOptions = () => {
			const map = {
				content: {
					title: __('Content', 'neve'),
					icon: 'admin-post'
				},
				customizer: {
					title: __('Customizer', 'neve'),
					icon: 'admin-customizer'
				},
				widgets: {
					title: __('Widgets', 'neve'),
					icon: 'admin-generic'
				}
			};
			return (
				<div className="options general">
					<h3>{__('General', 'neve')}:</h3>
					<ul>
						{Object.keys(map).map((id) => {
							return (
								<li>
									<Dashicon className={classnames({'active': general[id]})} icon={map[id].icon}/>
									<span>{map[id].title}</span>
									<div className="toggle-wrapper">
										<ToggleControl
											checked={general[id]}
											onChange={() => {
												setGeneral({...general, [id]: ! general[id]});
											}}
										/>
									</div>
								</li>
							);
						})}
					</ul>
				</div>
			);
		};
		const renderPlugins = () => {
			const allPlugins = {...(siteData['recommended_plugins'] || {}), ...(siteData['mandatory_plugins'] || {})};

			return (
				<div className="options plugins">

					<h3>{__('Plugins', 'neve')}:</h3>
					<ul>
						{Object.keys(allPlugins).map((slug) => {
							return (
								<li>
									<Dashicon icon="admin-plugins" className={classnames({'active': pluginOptions[slug]})}/>
									<span dangerouslySetInnerHTML={{__html: allPlugins[slug]}}/>
									{slug in siteData['recommended_plugins'] &&
									<div className="toggle-wrapper">
										<ToggleControl
											checked={pluginOptions[slug]}
											onChange={() => {
												setPluginOptions({...pluginOptions, [slug]: ! pluginOptions[slug]});
											}}
										/>
									</div>
									}
								</li>
							);
						})}
					</ul>
				</div>
			);
		};

		function runImport() {
			console.clear();
			if (! pluginOptions) {
				console.log('[S] Plugins.');
				runImportContent();
				return false;
			}
			setCurrentStep('plugins');
			console.log('[P] Plugins.');
			installPlugins(pluginOptions).then(response => {
				if (! response.success) {
					handleError(response, 'plugins');
					return false;
				}
				console.log('[D] Plugins.');
				setPluginsProgress('done');
				runImportContent();
			}).catch((error) => handleError(error, 'plugins'));
		}

		function runImportContent() {
			if (! general.content) {
				console.log('[S] Content.');
				runImportCustomizer();
				return false;
			}
			setCurrentStep('content');
			console.log('[P] Content.');
			importContent({
				contentFile: siteData['content_file'],
				source: siteData.source,
				frontPage: siteData['front_page'],
				shopPages: siteData['shop_pages'],
				demoSlug: siteData.slug,
				editor
			}).then(response => {
				if (! response.success) {
					handleError(response, 'content');
					return false;
				}
				console.log('[D] Content.');
				if (response['frontpage_id']) {
					setFrontPageID(response['frontpage_id']);
				}
				setContentProgress('done');
				runImportCustomizer();
			}).catch((error) => handleError(error, 'content'));
		}

		function runImportCustomizer() {
			if (! general.customizer) {
				console.log('[S] Customizer.');
				runImportWidgets();
				return false;
			}
			setCurrentStep('customizer');
			console.log('[P] Customizer.');
			importMods({
				'source_url': siteData['demo_url'],
				'theme_mods': siteData['theme_mods'],
				'wp_options': siteData['wp_options']
			}).then(response => {
				if (! response.success) {
					handleError(response, 'customizer');
					return false;
				}
				console.log('[D] Customizer.');
				setCustomizerProgress('done');
				runImportWidgets();
			}).catch((error) => handleError(error, 'customizer'));
		}

		function runImportWidgets() {
			if (! general.widgets) {
				console.log('[S] Widgets.');
				importDone();
			}
			setCurrentStep('widgets');
			console.log('[P] Widgets.');
			importWidgets(siteData.widgets).then(response => {
				if (! response.success) {
					handleError(response, 'widgets');
					return false;
				}
				console.log('[D] Widgets.');
				setWidgetsProgress('done');
				importDone();
			}).catch((error) => handleError(error, 'widgets'));
		}

		function importDone() {
			setCurrentStep('done');
			setImporting(false);
		}

		function handleError(error, step) {
			setImporting(false);
			setCurrentStep(null);
			if ('plugins' === step) {
				setContentProgress('skip');
			}
			if ([ 'content', 'plugins' ].includes(step)) {
				setCustomizerProgress('skip');
			}
			if ([ 'content', 'plugins', 'customizer' ].includes(step)) {
				setWidgetsProgress('skip');
			}

			const map = {
				'plugins': __('Something went wrong while installing the necessary plugins.', 'neve'),
				'content': __('Something went wrong while importing the website content.', 'neve'),
				'customizer': __('Something went wrong while updating the customizer settings.', 'neve'),
				'widgets': __('Something went wrong while importing the widgets.', 'neve')
			};

			switch (step) {
				case 'plugins':
					setPluginsProgress('error');
					break;
				case 'content':
					setContentProgress('error');
					break;
				case 'customizer':
					setCustomizerProgress('error');
					break;
				case 'widgets':
					setWidgetsProgress('error');
					break;
			}
			setError(error.data ? {message: map[step], code: error.data} : {message: map[step]});
		}

		const closeModal = (dismissSiteData = false) => {
			if (importing) {
				return false;
			} else {
				setModal(false);
				if (dismissSiteData) {
					setSite(null);
				}
			}
		};

		const allOptionsOff = Object.keys(general).every(k => false === general[k]);
		const editLinkMap = {
			'elementor': `${neveDash.onboarding.homeUrl}/wp-admin/post.php?post=${frontPageID}&action=elementor`,
			'brizy': `${neveDash.onboarding.homeUrl}/?brizy-edit`,
			'beaver builder': `${neveDash.onboarding.homeUrl}/?fl_builder`,
			'thrive architect': `${neveDash.onboarding.homeUrl}/wp-admin/post.php?post=${frontPageID}&action=architect&tve=true`,
			'divi builder': `${neveDash.onboarding.homeUrl}/?et_fb=1&PageSpeed=off`,
			'gutenberg': `${neveDash.onboarding.homeUrl}/wp-admin/post.php?post=${frontPageID}&action=edit`
		};
		const editLink = editLinkMap[editor];
		return (
			<Modal
				className="ob-import-modal"
				title={siteData.title}
				onRequestClose={closeModal}
				shouldCloseOnClickOutside={! importing}
				isDismissible={! importing}
			>
				<div className="modal-body">
					{! importing && 'done' !== currentStep && ! error ?
						<Fragment>
							{renderNote()}
							<hr/>
							{renderOptions()}
							<hr/>
							{renderPlugins()}
						</Fragment> :
						<Fragment>
							{error &&
							<Fragment>
								<ImportModalError message={error.message || null} code={error.code || null}/>
								<hr/>
							</Fragment>
							}
							<ImportStepper progress={{
								plugins: pluginsProgress,
								content: contentProgress,
								customizer: customizerProgress,
								widgets: widgetsProgress
							}} currentStep={currentStep} willDo={general}/>
							{'done' === currentStep &&
							<Fragment>
								<hr/>
								<p className="import-result">
									{__('Content was successfully imported. Enjoy your new site!', 'neve')}
								</p>
								<hr/>
							</Fragment>
							}
						</Fragment>
					}
				</div>
				{! importing &&
				<div className="modal-footer">
					{'done' !== currentStep ?
						<Fragment>
							<Button
								isSecondary
								onClick={closeModal}>
								{__('Close', 'neve')}
							</Button>
							{! error &&
							<Button
								isPrimary
								disabled={allOptionsOff || siteData['external_plugins']}
								onClick={() => {
									setImporting(true);
									runImport();
								}}>
								{__('Import', 'neve')}
							</Button>
							}
						</Fragment> :
						<Fragment>
							<Button
								isLink
								className="close"
								onClick={() => {
									closeModal(true);
								}}>{__('Back to Sites Library', 'neve')}</Button>
							<Button
								isSecondary
								href={neveDash.onboarding.homeUrl}
							>{__('View Website', 'neve')}</Button>
							<Button isPrimary href={editLink}>
								{__('Add your own content', 'neve')}
							</Button>
						</Fragment>
					}
				</div>
				}
			</Modal>
		);
	}
;

export default compose(
	withSelect((select) => {
		const {getCurrentEditor, getCurrentSite} = select('neve-onboarding');
		return {
			editor: getCurrentEditor(),
			siteData: getCurrentSite()
		};
	}),
	withDispatch((dispatch) => {
		const {setImportModalStatus, setCurrentSite} = dispatch('neve-onboarding');
		return {
			setModal: (status) => setImportModalStatus(status),
			setSite: (data) => setCurrentSite(data)
		};
	})
)(ImportModal);
