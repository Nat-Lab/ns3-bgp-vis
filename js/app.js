(function () {
    var result = [];
    var container = document.getElementById('display');
    var nodes = new vis.DataSet();
    var edges = new vis.DataSet();
    
    var APICaller = function (api_server) {
        return function (method, cb) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', api_server + method);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.onload = function () {
                if (this.status == 200) {
                    cb(JSON.parse(xhr.response));
                } else {
                    throw JSON.parse(xhr.response);
                }
            };
            xhr.send();
        };
    };
    
    var graph = new vis.Network(container, {nodes, edges}, {
        nodes: {
            borderWidth: 1,
            size: 30,
            color: {
                border: '#333',
                background: '#eee'
            },
            font: {
                face: 'monospace'
            },
            shapeProperties: {
                borderRadius: 0
            }
        }
    });
    
    var addNode = function(id, ghost = false) {
        try {
            if (!ghost) nodes.add({id, label: id, shape: 'box'});
            else nodes.add({id, label: id, shape: 'box', color: {
                border: '#f00',
                background: '#ffafaf'
            }});
        } catch (e) {}
    };
    
    var addEdge = function(n1, n2) {
        [n1, n2].forEach(n => {
            if (!nodes.get().filter(e => e.id == n).length) addNode(n, true);
        });
        if (n1 == n2) return;
        if(!edges.get().filter(e => (e.from == n1 && e.to == n2) || (e.from == n2 && e.to == n1)).length)
            edges.add({from: n1, to: n2});
    };
    
    var setInfoPlate = function(node) {
        var asn = document.getElementById('infoplate_as');
        var peers = document.getElementById('infoplate_peers');
        peers.innerHTML = '';
        var routes = document.getElementById('infoplate_routes');
        routes.innerHTML ='';
        asn.innerText = node;

        var ps = [], rs = [];

        result.filter(n => n.as == node).forEach(n => {
            ps = ps.concat(n.peers);
            rs = rs.concat(n.routes);
        });

        ps.filter((v, i, s) => s.indexOf(v) == i).forEach(peer => {
            var li = document.createElement('li');
            li.innerText = `AS${peer}`;
            li.onclick = function () {
                graph.selectNodes([peer]);
            };
            peers.appendChild(li);
        });

        var sel_routes = [];
        
        rs.forEach(r1 => {
            if (sel_routes.some(r => r.prefix == r1.prefix)) return;
            var sel_route = r1;
            rs.forEach(r2 => {
                if (r1.prefix == r2.prefix) {
                    if (sel_route.as_path.length > r2.as_path.length)
                        sel_route = r2;
                }
            });
            sel_routes.push(sel_route);
        });

        sel_routes.forEach(route => {
            var li = document.createElement('li');
            li.innerText = route.prefix;
            li.onclick = function () {
                graph.setSelection({
                    nodes: route.as_path,
                    edges: edges.get()
                        .filter(e => route.as_path
                            .map((cur, idx, src) => [cur, src[idx+1]])
                            .slice(0, route.as_path.length - 1
                        ).some(s => (s[0] == e.from && s[1] == e.to) || (s[1] == e.from && s[0] == e.to)))
                        .map(e => e.id)
                }, {unselectAll: true, highlightEdges: false});
            };
            routes.appendChild(li);
        });
    };
    
    var api = new APICaller('/');
    
    api('status', rs => {
        result = rs;
        rs.forEach(status => {
            addNode(status.as);
        });
        
        rs.forEach(status => {
            status.peers.forEach(peer => {
                addEdge(status.as, peer);
            });
        })
    });
    
    graph.on('select', e => {
        if(e.nodes.length) setInfoPlate(e.nodes[0]);
    });
})();