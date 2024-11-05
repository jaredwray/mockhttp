package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/jaredwray/mockhttp/docs"
	httpSwagger "github.com/swaggo/http-swagger"
)

// @title MockHTTP API
// @version 1.0
// @description This is a mock HTTP server inspired by httpbin, built with Go and Gorilla Mux.
// @host localhost:8080
// @BasePath /
func main() {
	// Allow setting the port via --port flag or PORT environment variable
	var port string
	flag.StringVar(&port, "port", "", "Port to run the server on")
	flag.Parse()

	if port == "" {
		port = os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
	}

	r := mux.NewRouter()

	// Defining routes
	r.HandleFunc("/", HomePageHandler).Methods(http.MethodGet)
	r.HandleFunc("/get", GetHandler).Methods(http.MethodGet)
	r.HandleFunc("/post", PostHandler).Methods(http.MethodPost)
	r.HandleFunc("/headers", HeadersHandler).Methods(http.MethodGet)
	r.HandleFunc("/status/{code}", StatusHandler).Methods(http.MethodGet)
	r.HandleFunc("/delay/{seconds}", DelayHandler).Methods(http.MethodGet)
	r.HandleFunc("/ip", IPHandler).Methods(http.MethodGet)
	r.HandleFunc("/anything", AnythingHandler).Methods(http.MethodGet)
	r.HandleFunc("/json", JSONHandler).Methods(http.MethodGet)

	// Serve Swagger docs.json
	r.HandleFunc("/doc.json", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./docs/swagger.json")
	}).Methods(http.MethodGet)

	// Serve Swagger documentation
	r.PathPrefix("/swagger").Handler(httpSwagger.WrapHandler)

	// Starting the server
	fmt.Printf("Starting mockhttp server on http://localhost:%s", port)
	http.ListenAndServe(":"+port, r)
}

// HomePageHandler serves the main page similar to httpbin.org
func HomePageHandler(w http.ResponseWriter, r *http.Request) {
	tmpl := `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>MockHTTP - Home</title>
	</head>
	<body>
		<h1>Welcome to MockHTTP</h1>
		<p>A simple HTTP request & response service, inspired by httpbin.org.</p>
		<ul>
			<li><a href="/get">/get</a> - Returns GET request data.</li>
			<li><a href="/post">/post</a> - Returns POST request data.</li>
			<li><a href="/headers">/headers</a> - Returns request headers.</li>
			<li><a href="/status/200">/status/{code}</a> - Returns response with the given status code.</li>
			<li><a href="/delay/3">/delay/{seconds}</a> - Returns response after a given delay.</li>
			<li><a href="/ip">/ip</a> - Returns the client's IP address.</li>
			<li><a href="/anything">/anything</a> - Returns request data for any request.</li>
			<li><a href="/json">/json</a> - Returns a sample JSON response.</li>
			<li><a href="/swagger">Swagger Documentation</a> - API documentation.</li>
		</ul>
	</body>
	</html>
	`
	tmplParsed, err := template.New("homepage").Parse(tmpl)
	if err != nil {
		http.Error(w, "Error rendering page", http.StatusInternalServerError)
		return
	}
	tmplParsed.Execute(w, nil)
}

// Handlers

// GetHandler godoc
// @Summary Get request information
// @Description Returns the query parameters, headers, and URL of the request
// @Tags get
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /get [get]
func GetHandler(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"args":    r.URL.Query(),
		"headers": r.Header,
		"url":     r.URL.String(),
	}
	json.NewEncoder(w).Encode(response)
}

// PostHandler godoc
// @Summary Post request information
// @Description Returns the posted data, headers, and URL of the request
// @Tags post
// @Accept  json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /post [post]
func PostHandler(w http.ResponseWriter, r *http.Request) {
	var payload map[string]interface{}
	json.NewDecoder(r.Body).Decode(&payload)
	response := map[string]interface{}{
		"data":    payload,
		"headers": r.Header,
		"url":     r.URL.String(),
	}
	json.NewEncoder(w).Encode(response)
}

// HeadersHandler godoc
// @Summary Get request headers
// @Description Returns the headers of the request
// @Tags headers
// @Produce json
// @Success 200 {object} map[string][]string
// @Router /headers [get]
func HeadersHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(r.Header)
}

// StatusHandler godoc
// @Summary Return custom status code
// @Description Returns a response with the specified status code
// @Tags status
// @Param code path int true "Status code"
// @Produce plain
// @Success 200 {string} string "OK"
// @Failure 400 {string} string "Invalid status code"
// @Router /status/{code} [get]
func StatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	codeStr := vars["code"]
	code, err := strconv.Atoi(codeStr)
	if err != nil || code < 100 || code > 599 {
		http.Error(w, "Invalid status code", http.StatusBadRequest)
		return
	}
	w.WriteHeader(code)
}

// DelayHandler godoc
// @Summary Delayed response
// @Description Returns a response after a specified delay in seconds
// @Tags delay
// @Param seconds path int true "Delay in seconds"
// @Produce plain
// @Success 200 {string} string "Response after {seconds} second(s)"
// @Failure 400 {string} string "Invalid delay time"
// @Router /delay/{seconds} [get]
func DelayHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	secondsStr := vars["seconds"]
	seconds, err := strconv.Atoi(secondsStr)
	if err != nil || seconds < 0 {
		http.Error(w, "Invalid delay time", http.StatusBadRequest)
		return
	}
	time.Sleep(time.Duration(seconds) * time.Second)
	w.Write([]byte(fmt.Sprintf("Response after %d second(s)", seconds)))
}

// IPHandler godoc
// @Summary Get requester's IP address
// @Description Returns the IP address of the requester
// @Tags ip
// @Produce json
// @Success 200 {object} map[string]string
// @Router /ip [get]
func IPHandler(w http.ResponseWriter, r *http.Request) {
	ip := r.RemoteAddr
	response := map[string]string{"origin": ip}
	json.NewEncoder(w).Encode(response)
}

// AnythingHandler godoc
// @Summary Echo request information
// @Description Returns the method, headers, query parameters, and URL of the request
// @Tags anything
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /anything [get]
func AnythingHandler(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"method":  r.Method,
		"headers": r.Header,
		"args":    r.URL.Query(),
		"url":     r.URL.String(),
	}
	json.NewEncoder(w).Encode(response)
}

// JSONHandler godoc
// @Summary Get a sample JSON response
// @Description Returns a sample JSON payload
// @Tags json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /json [get]
func JSONHandler(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"message": "Hello, mockhttp!",
		"author":  "mockhttp team",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
