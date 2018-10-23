// Create a default AjaxSequencer and pass it to PipelineService.
let ajaxSequencer = AjaxSequencer($);
let pipelineService = PipelineService($, ajaxSequencer);

/**
 * Templates shared by more than one component.
 */
const pipelineHeaderTemplate = `<pipeline-header v-bind:pipeline="pipeline" v-bind:states="pipeline.states"/>`;
const pipelineBodyTemplate =`
    <ul class="list-group list-group-flush">
       <li v-for="state in pipeline.states">
           <pipeline-state v-bind:state="state"/>
       </li>
    </ul>`;

/**
 * @component <the-page-header> - pretty much static. Take the <title> text and insert it into the header.
 */
Vue.component("ThePageHeader", {
  template: `
            <nav class="navbar navbar-light bg-light mb-4 mt-4">
                <a class="navbar-brand mr-auto" href="#">Dashboard</a>

                <span class="navbar-text mr-2">
                    <span class="badge badge-success">succeeded</span>
                </span>

                <span class="navbar-text mr-2">
                    <span class="badge badge-info">in progress</span>
                </span>

                <span class="navbar-text mr-2">
                    <span class="badge badge-danger">failed</span>
                </span>
            </nav>
  `,
  mounted() {
    // Update the title of the dashboard in the nav bar, from the text of the "title" element.
    $('.navbar-brand').text($('title').text());
  }
});

/**
 * @component <the-pipeline-grid> - contains a list of <pipeline> components.
 */
const ThePipelineGrid = Vue.component("ThePipelineGrid", {
  props: ["pipelines"],
  template: `
            <div class="card-deck">
                <pipeline v-for="pipeline in pipelines" v-bind:pipeline="pipeline" />
            </div>
  `
});

/**
 * @component <pipeline> - contains a <pipeline-header> component and a list of <pipeline-stage> components.
 *
 * Clicking of the body navigates to a card detail route.
 */
Vue.component("pipeline", {
  props: ["pipeline"], // attribute of tag
  template: `
    <div v-bind:class="['card', 'bg-light', 'mb-4']" style="min-width: 350px" v-on:click="clickHandler">
        <div class="card-body">${ pipelineHeaderTemplate }</div>
        ${ pipelineBodyTemplate}
    </div>
    `,
  methods: {
    clickHandler: function() {
      router.push('/card/' + this.pipeline.name);
    }
  }
});

/**
 * @component <pipeline-header> - contains information about the entire Pipeline.
 */
Vue.component("PipelineHeader", {
  props: ["pipeline", "states"], // attribute of tag
  template: `
        <span>
            <h5 class="card-title">{{ pipeline.name }}</h5>
            <p class="card-text">
                <span class="text-muted mb-2">
                    Started {{ startDate }}
                    <span class="badge badge-secondary float-right">took {{ duration }}</span>
                </span><br />
                <small>{{ pipeline.commitMessage }}</small>
            </p>
        </span>
    `,
  data: function() {
    return {
      duration: 0,
      startDate: "-"
    };
  },
  watch: {
    states: function(states) {
      this.getPipelineDetails(this.states || []);
    }
  },
  mounted() {
    this.getPipelineDetails(this.states || []);
  },
  methods: {
    getPipelineDetails: function (states) {
      let min = (states.length) ? states[0].lastStatusChange : 0;
      let max = Math.max.apply(Math, states.map((state) => state.lastStatusChange));
      this.duration = moment.duration(max - min).humanize();
      this.startDate = moment(min).fromNow();
    }
  }
});

/**
 * @component <pipeline-state> - contains the State name, and a list of <pipeline-stage> components.
 */
Vue.component("PipelineState", {
  props: ["state"],
  template: `
    <div class="panel panel-default border rounded">
      <small class="panel-heading mx-3">{{ state.name }}</small>
      <div class="panel-body">
        <ul class="list-group list-group-flush">
            <li v-for="stage in state.stages">
                <pipeline-stage v-bind:stage="stage"/>
            </li>
        </ul>
        </div>
      </div>
    </div>
  `
});

/**
 * @component <pipeline-stage> - contains name, revision and last execution time/date.
 */
Vue.component("PipelineStage", {
  props: ["stage"],
  template: `
    <div class="list-group-item" v-bind:class="extraClass">
      <div class="d-flex align-items-center">
          <div class="flex-grow-1">{{ stage.name }}</div>
          <div class="pl-2 pr-2 small rounded border border-secondary" v-bind:class="showRevision">{{ revisionId }}</div>
          <div class="p-1">
              <span v-bind:class="badgeType">
                  <a class="text-light" v-bind:href="this.stage.externalExecutionUrl">{{ latestExecutionDate }}</a>
              </span>
          </div>
      </div>
      <div>{{ stage.errorDetails }}</div>
    </div>
`,
  methods: {
    isActionRequired: function() {
      for (let j=0; j < needsHumanInteraction.length; j++) {
        var needs = needsHumanInteraction[j];
        if (this.matchesStage(needs, this.stage.name) && this.matchesStatus(needs, this.stage.latestStatus)) {
          return true;
        }
      }
      return false;
    },
    matchesStage: function(needs, name) {
      return name.toLowerCase().indexOf(needs.stage.toLowerCase()) >= 0;
    },
    matchesStatus: function(needs, status) {
      return status.indexOf(needs.status) >= 0;
    }
  },
  computed: {
    isSucceeded: function() {
      return this.stage.latestStatus === "succeeded";
    },
    isFailed: function() {
      return this.stage.latestStatus === "failed";
    },
    isInProgress: function() {
      return this.stage.latestStatus === "inprogress";
    },
    latestExecutionDate: function() {
      return moment(this.stage.lastStatusChange).fromNow();
    },
    showRevision: function() {
      return (this.stage.revisionId) ? '' : 'd-none';
    },
    revisionId: function() {
      const revisionId = this.stage.revisionId || "";
      return revisionId.substr(0,7);
    },
    badgeType: function() {
      switch (this.stage.latestStatus) {
        case "succeeded":
          return "badge badge-success";
        case "failed":
          return "badge badge-danger";
        case "inprogress":
          return "badge badge-info";
      }
    },
    extraClass: function() {
      let extra = '';
      if (this.isActionRequired()) {
        extra = 'stage-needs-action';
      } else if (this.isFailed) {
        extra = 'stage-failed';
      }
      return extra;
    }
  }
});

/**
 * @component <pipeline-card> - contains a <pipeline-header> component and ... additional information.
 */
const PipelineCard = Vue.component("PipelineCard", {
  props: ["pipelineName"],
  template: `
    <div v-bind:class="['card', 'bg-light', 'mb-4']" style="min-width: 350px">
        <div class="card-body">
          <button type="button" class="close" aria-label="Close" v-on:click="navBack">
            <span aria-hidden="true">&times;</span>
          </button>
          ${ pipelineHeaderTemplate }
        </div>
        ${ pipelineBodyTemplate }
    </div>
  `,
  data: function() {
    return {
      pipeline: {}
    };
  },
  methods: {
    navBack: function() {
      router.back();
    },
    getPipelineDetails: function(pipelineName) {
      pipelineService.getPipelineDetails(pipelineName)
        .done((pipeline) => this.pipeline = pipeline)
        .always(() => app.loading = false);
    }
  },
  mounted() {
    this.getPipelineDetails(this.pipelineName);
  }
});

// If refreshInterval is set to zero, no refreshing takes place.
// refreshInterval is set to zero with "?static" or "?refresh=0" search params.
// refreshInterval is set to 60 seconds for "?refresh" or "?refresh=" search params.
// refreshInterval is set to NN seconds for "?refresh=NN", where NN is some number of seconds.
const queryParams = window.location.search.substr(1).split('&').map((elem) => elem.split('=')).reduce((p,c) => { p[c[0]] = c[1]; return p; }, {});
queryParams.refresh = (typeof queryParams.refresh === 'undefined') ? 60 : queryParams.refresh;
const refreshInterval = (queryParams.hasOwnProperty('static')) ? 0 : (1000 * queryParams.refresh);

let refreshId;

let app = {};
let gridPipelines = [];

// 2. Define some routes
// Each route should map to a component. The "component" can
// either be an actual component constructor created via
// `Vue.extend()`, or just a component options object.
// We'll talk about nested routes later.
const routes = [
  { path: '/', component: ThePipelineGrid, props: { pipelines: gridPipelines } },
  { path: '/card/:pipelineName', component: PipelineCard, props: true }
];

// 3. Create the router instance and pass the `routes` option
// You can pass in additional options here, but let's
// keep it simple for now.
const router = new VueRouter({
  routes // short for `routes: routes`
});

// Before each route, clear the ajaxSequencer in case we have a backlog of Ajax calls outstanding.
// We're switching routes, so we don't care about them anymore.
router.beforeEach((to, from, next) => {
  ajaxSequencer.clear();
  next();
});

// After each route, figure out what needs to be refreshed and how to go about doing it.
// For now, we re-fetch all pipelines when showing the grid, but we reload the entire page
// when showing an individual card.
router.afterEach((to, from) => {
  // Cancel any interval from the previous route.
  window.clearInterval(refreshId);

  // Show the loading indicator (even if just briefly).
  app.loading = true;

  if (to.path === '/') {
    fetchAllPipelines();
    if (refreshInterval) {
      refreshId = window.setInterval(fetchAllPipelines, refreshInterval);
    }
  } else if (refreshInterval) {
    refreshId = window.setInterval(() => window.location.reload(), refreshInterval);
  }
});

function fetchAllPipelines() {
  // Navigating to the initial path. Fetch all pipeline data.
  pipelineService.getPipelines().done((names) => {
    let promises = [];
    let pipelines = [];

    for (let i = 0; i < names.length; i++) {
      // Fetch the details for each pipeline. Do this in a closure so we can track each promise.
      promises.push(function(name, i) {
        let promise = pipelineService.getPipelineDetails(name);
        promise.done((pipeline) => pipelines[i] = pipeline);
        return promise;
      }(names[i], i));
    }

    // When all promises have completed, sort them with most recently changes first.
    $.when.apply($, promises).done(() => {

      // Sort the array of pipelines.
      pipelines = pipelines.sort(function(a, b) {
        // Useful for testing. Randomize the order every time.
//         return Math.random() - Math.random();
        return b.lastStatusChange - a.lastStatusChange;
      });

      // Replace the contents of app.pipelines with these new (sorted) pipelines.
      app.pipelines.splice(0, app.pipelines.length, ...pipelines);
    }).always(() => app.loading = false);
  });
}

// Finally, create the Vue object.
app = new Vue({
  el: "#app",
  router: router,
  data: {
    pipelines: gridPipelines,
    loading: true
  },
  methods: {}
});

